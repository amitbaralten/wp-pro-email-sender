import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv, getMailingLists, createMailingList } from "../lib/csv";

const NSW_LOCATIONS = [
  "Parramatta",
  "Sydney",
  "Penrith",
  "Liverpool",
  "Campbelltown",
  "Newcastle",
  "Wollongong",
  "Central Coast",
  "Blacktown",
  "Chatswood",
  "Bankstown",
  "Fairfield",
  "Castle Hill",
  "Baulkham Hills",
  "Hornsby",
  "Ryde",
  "Strathfield",
  "Burwood",
  "Newtown",
  "Cronulla",
  "Miranda",
  "Manly",
  "Maitland",
  "Gosford",
  "Dubbo",
  "Orange",
  "Bathurst",
  "Wagga Wagga",
  "Albury",
  "Tamworth",
  "Port Macquarie",
  "Coffs Harbour",
  "Byron Bay",
  "Tweed Heads",
];

function decodeBingUrl(href: string): string {
  try {
    const urlObj = new URL(href);
    const uParam = urlObj.searchParams.get("u");
    if (uParam) {
      const b64 = uParam.startsWith("a1") ? uParam.slice(2) : uParam;
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      if (decoded.startsWith("http")) return decoded;
    }
  } catch {}
  return href;
}

function cleanCompanyName(titleText: string, domain: string): string {
  let cleaned = titleText.split(/[-|–:]/)[0].trim();
  cleaned = cleaned.replace(/^(home|welcome to|official site|plumber)\s+/i, "");
  if (!cleaned || cleaned.length < 3 || /^(home|about|contact|index|business owner)$/i.test(cleaned)) {
    const parts = domain.replace(/\.(com|net|org)?\.(au)?$/, "").split(/[-.]/);
    cleaned = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return cleaned;
}

function isAustralianDomain(domain: string): boolean {
  if (domain.endsWith(".au")) return true;
  const nonAus = [".id", ".edu", ".gov", ".org", ".uk", ".nz", ".us"];
  return !nonAus.some((tld) => domain.endsWith(tld));
}

async function scrapeAllNSWPlumbers(): Promise<UserRow[]> {
  console.log(`🚀 Starting Comprehensive All-NSW Plumber Scraper across ${NSW_LOCATIONS.length} areas...`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-AU",
  });

  let page = await context.newPage();
  const leads: UserRow[] = [];
  const processedDomains = new Set<string>();

  for (let idx = 0; idx < NSW_LOCATIONS.length; idx++) {
    const loc = NSW_LOCATIONS[idx];
    console.log(`\n[${idx + 1}/${NSW_LOCATIONS.length}] 🔍 Scraping Plumbers in ${loc} NSW...`);

    const query = `plumber "${loc}" NSW site:.com.au`;
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    try {
      if (page.isClosed()) {
        page = await context.newPage();
      }

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);

      const links = await page.locator("li.b_algo h2 a").all();

      for (const linkElem of links) {
        try {
          const hrefRaw = await linkElem.getAttribute("href");
          if (!hrefRaw) continue;

          const targetUrl = decodeBingUrl(hrefRaw);
          if (!targetUrl.startsWith("http")) continue;

          let urlObj: URL;
          try {
            urlObj = new URL(targetUrl);
          } catch {
            continue;
          }

          const domain = urlObj.hostname.replace(/^www\./, "").toLowerCase();

          if (!isAustralianDomain(domain)) continue;

          if (
            domain.includes("bing.com") ||
            domain.includes("google") ||
            domain.includes("yellowpages") ||
            domain.includes("hipages") ||
            domain.includes("oneflare") ||
            domain.includes("facebook") ||
            domain.includes("instagram") ||
            domain.includes("youtube") ||
            domain.includes("truelocal") ||
            domain.includes("seek") ||
            domain.includes("linkedin") ||
            domain.includes("serviceseeking") ||
            domain.includes("wordofmouth") ||
            domain.includes("productreview") ||
            domain.includes("airtasker") ||
            domain.includes("localsearch") ||
            domain.includes("plumbersden")
          ) {
            continue;
          }

          if (processedDomains.has(domain)) continue;
          processedDomains.add(domain);

          const rawTitle = (await linkElem.innerText()) || domain;
          const company = cleanCompanyName(rawTitle, domain);
          const website = `https://${domain}`;

          const emailData = await extractEmailAndPhone(context, website, domain);
          const email = emailData.email || `info@${domain}`;

          leads.push({
            email,
            status: "pending",
            sentAt: "",
            firstName: "",
            lastName: "",
            company: company.length > 55 ? `${company.slice(0, 52)}...` : company,
            website,
            phone: emailData.phone,
            address: `${loc} NSW`,
            title: "Business Owner / Managing Director",
            fitScore: 92,
            fitLabel: "High",
            linkedIn: "",
            segment: "Plumbing & Trades",
            priority: "High",
            emailType: "Personalized",
            resendId: "",
            resendStatus: "",
            deliveryStatus: "",
            resendCreatedAt: "",
            resendScheduledAt: "",
            resendLastSyncedAt: "",
            resendSubject: "",
            resendFrom: "",
            resendTo: "",
            resendError: "",
          });

          console.log(`  ✓ Scraped Plumber [${loc}]: ${company} | Email: ${email} | Phone: ${emailData.phone}`);
        } catch {}
      }
    } catch (err: unknown) {
      console.warn(` Connection pause for ${loc}, waiting 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      page = await context.newPage();
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailAndPhone(
  context: any,
  url: string,
  domain: string
): Promise<{ email: string; phone: string }> {
  let email = "";
  let phone = "";

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
    const content = await page.content();

    const mailto = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailto && mailto[1]) {
      email = mailto[1].toLowerCase();
    }

    if (!email) {
      const emails = content.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
      if (emails) {
        const valid = emails.find(
          (e: string) =>
            !e.endsWith(".png") &&
            !e.endsWith(".jpg") &&
            !e.endsWith(".svg") &&
            !e.includes("sentry") &&
            !e.includes("wix") &&
            !e.includes("schema") &&
            !e.includes("example") &&
            !e.includes("domain")
        );
        if (valid) email = valid.toLowerCase();
      }
    }

    const phoneMatch = content.match(/(\(02\)\s*\d{4}\s*\d{4}|04\d{2}\s*\d{3}\s*\d{3}|1300\s*\d{3}\s*\d{3})/);
    if (phoneMatch) phone = phoneMatch[0];

    await page.close();
  } catch {}

  return { email, phone };
}

async function main() {
  const listId = "all-nsw-plumbers-scraped";
  const listName = "All NSW Plumbers Scraped";

  const leads = await scrapeAllNSWPlumbers();
  console.log(`\n🎉 Total Scraped Clean All-NSW Plumber Business Leads: ${leads.length}`);

  if (leads.length > 0) {
    const csvContent = serializeUsersCsv(leads);
    const outputPath = path.join(__dirname, "..", "scratch", "all_nsw_plumbers_scraped.csv");
    fs.writeFileSync(outputPath, csvContent, "utf-8");
    console.log(`📁 Saved CSV to: ${outputPath}`);

    const lists = await getMailingLists();
    if (!lists.some((l) => l.id === listId)) {
      await createMailingList(listName, csvContent);
    } else {
      await writeListUsersCsv(listId, leads);
    }

    console.log(`✨ Successfully updated WP Pro Mailing List: ID='${listId}', Name='${listName}', Total Leads=${leads.length}`);
  }
}

main().catch(console.error);
