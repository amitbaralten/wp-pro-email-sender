import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { createMailingList } from "../lib/csv";

const LOCATIONS = [
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
  "Dubbo",
  "Wagga Wagga",
  "Albury",
  "Tamworth",
  "Orange",
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

async function scrapeNSWPlumbers(): Promise<UserRow[]> {
  console.log("🚀 Starting Master Bing & Web Scraper for NSW Plumbers...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-AU",
  });

  const page = await context.newPage();
  const leads: UserRow[] = [];
  const processedDomains = new Set<string>();

  for (const loc of LOCATIONS) {
    const query = `plumber ${loc} NSW Australia contact email`;
    console.log(`\n🔍 Searching: "${query}"...`);

    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);

      const links = await page.locator("li.b_algo h2 a").all();
      console.log(`📍 Found ${links.length} organic search results for ${loc}`);

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
            domain.includes("wordofmouth")
          ) {
            continue;
          }

          if (processedDomains.has(domain)) continue;
          processedDomains.add(domain);

          const rawTitle = (await linkElem.innerText()) || domain;
          let company = rawTitle.split(/[-|–:]/)[0].trim();
          if (!company || company.length < 3) company = domain;

          const website = `https://${domain}`;
          console.log(`  🔎 Inspecting website: ${website} (${company})...`);

          const emailData = await extractEmailAndPhoneFromWebsite(context, website, domain);

          const email = emailData.email || `info@${domain}`;

          leads.push({
            email,
            status: "pending",
            sentAt: "",
            firstName: "",
            lastName: "",
            company: company.length > 50 ? `${company.slice(0, 47)}...` : company,
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

          console.log(`  ✓ Scraped Plumber: ${company} | Email: ${email} | Phone: ${emailData.phone}`);
        } catch {}
      }
    } catch (err: unknown) {
      console.warn(` Warning for ${loc}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailAndPhoneFromWebsite(
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
            !e.includes("example")
        );
        if (valid) email = valid.toLowerCase();
      }
    }

    const tel = content.match(/tel:([0-9\s+()-]+)/i);
    if (tel && tel[1]) {
      phone = tel[1].trim();
    } else {
      const phoneMatch = content.match(/(\(02\)\s*\d{4}\s*\d{4}|04\d{2}\s*\d{3}\s*\d{3}|1300\s*\d{3}\s*\d{3})/);
      if (phoneMatch) phone = phoneMatch[0];
    }

    await page.close();
  } catch {}

  return { email, phone };
}

async function main() {
  const leads = await scrapeNSWPlumbers();
  console.log(`\n🎉 Total Scraped NSW Plumber Leads: ${leads.length}`);

  if (leads.length > 0) {
    const csvContent = serializeUsersCsv(leads);
    const outputPath = path.join(__dirname, "..", "scratch", "nsw_plumbers_scraped.csv");
    fs.writeFileSync(outputPath, csvContent, "utf-8");
    console.log(`📁 Saved CSV to: ${outputPath}`);

    const createdList = await createMailingList("NSW Plumbers Scraped", csvContent);
    console.log(`✨ Created WP Pro Mailing List: ID='${createdList.id}', Name='${createdList.name}', Total Leads=${createdList.totalLeads}`);
  }
}

main().catch(console.error);
