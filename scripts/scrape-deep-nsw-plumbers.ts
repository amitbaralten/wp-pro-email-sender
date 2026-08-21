import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv, getMailingLists, createMailingList } from "../lib/csv";

const HIGH_DENSITY_PLUMBER_QUERIES = [
  "plumber Parramatta Sydney NSW contact email",
  "plumber Blacktown Penrith Liverpool NSW email",
  "plumber Newcastle Maitland Hunter NSW contact",
  "plumber Wollongong Shellharbour NSW contact",
  "plumber Central Coast Gosford Wyong NSW email",
  "plumber Northern Beaches Chatswood Manly NSW email",
  "plumber Hills District Castle Hill Baulkham Hills NSW",
  "plumber Sutherland Shire Miranda Cronulla NSW",
  "emergency plumber Sydney NSW contact info",
  "commercial plumber Sydney NSW email contact",
];

async function deepScrapeNSWPlumbers(): Promise<UserRow[]> {
  console.log(`🚀 Starting Deep Multi-Page Scraper across ${HIGH_DENSITY_PLUMBER_QUERIES.length} high-density targets...`);

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
  const processedEmails = new Set<string>();

  for (let idx = 0; idx < HIGH_DENSITY_PLUMBER_QUERIES.length; idx++) {
    const query = HIGH_DENSITY_PLUMBER_QUERIES[idx];
    console.log(`\n[${idx + 1}/${HIGH_DENSITY_PLUMBER_QUERIES.length}] 🔍 Deep Scraping: "${query}"...`);

    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);

      const links = await page.locator("li.b_algo h2 a").all();
      console.log(`📍 Found ${links.length} organic result targets.`);

      for (const linkElem of links) {
        try {
          const hrefRaw = await linkElem.getAttribute("href");
          if (!hrefRaw) continue;

          let targetUrl = hrefRaw;
          if (hrefRaw.includes("bing.com/ck/a")) {
            const uParam = new URL(hrefRaw).searchParams.get("u");
            if (uParam) {
              const b64 = uParam.startsWith("a1") ? uParam.slice(2) : uParam;
              targetUrl = Buffer.from(b64, "base64").toString("utf-8");
            }
          }

          if (!targetUrl.startsWith("http")) continue;
          const urlObj = new URL(targetUrl);
          const domain = urlObj.hostname.replace(/^www\./, "").toLowerCase();

          if (
            domain.includes("bing.com") ||
            domain.includes("google") ||
            domain.includes("facebook") ||
            domain.includes("instagram") ||
            domain.includes("youtube") ||
            domain.includes("seek") ||
            domain.includes("linkedin")
          ) {
            continue;
          }

          if (processedDomains.has(domain)) continue;
          processedDomains.add(domain);

          const rawTitle = (await linkElem.innerText()) || domain;
          let company = rawTitle.split(/[-|–:]/)[0].trim();
          if (!company || company.length < 3) {
            company = domain.replace(/\.(com|net|org)?\.(au)?$/, "");
          }

          const website = `https://${domain}`;
          console.log(`  🔎 Deep crawling domain: ${website}...`);

          const emailsFound = await deepCrawlDomainForEmails(context, website);

          for (const email of emailsFound) {
            if (processedEmails.has(email)) continue;
            processedEmails.add(email);

            leads.push({
              email,
              status: "pending",
              sentAt: "",
              firstName: "",
              lastName: "",
              company: company.length > 55 ? `${company.slice(0, 52)}...` : company,
              website,
              phone: "",
              address: "NSW Australia",
              title: "Business Owner / Managing Director",
              fitScore: 94,
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

            console.log(`  ✓ Discovered Lead: ${company} | Email: ${email}`);
          }
        } catch {}
      }
    } catch (err: unknown) {
      console.warn(` Warning for batch:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  return leads;
}

async function deepCrawlDomainForEmails(context: any, baseUrl: string): Promise<string[]> {
  const emails: Set<string> = new Set();
  const pagesToVisit = [baseUrl, `${baseUrl}/contact`, `${baseUrl}/contact-us`, `${baseUrl}/about`].slice(0, 3);

  for (const pageUrl of pagesToVisit) {
    try {
      const page = await context.newPage();
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 7000 });
      const content = await page.content();

      const mailtos = content.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
      for (const m of mailtos) {
        if (m[1]) emails.add(m[1].toLowerCase());
      }

      const rawMatches = content.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
      if (rawMatches) {
        for (const e of rawMatches) {
          const lower = e.toLowerCase();
          if (
            !lower.endsWith(".png") &&
            !lower.endsWith(".jpg") &&
            !lower.endsWith(".svg") &&
            !lower.includes("sentry") &&
            !lower.includes("wix") &&
            !lower.includes("schema") &&
            !lower.includes("example") &&
            !lower.includes("domain")
          ) {
            emails.add(lower);
          }
        }
      }

      await page.close();
      if (emails.size > 0) break;
    } catch {
    }
  }

  return Array.from(emails);
}

async function main() {
  const listId = "all-nsw-plumbers-scraped";
  const listName = "All NSW Plumbers Scraped";

  const leads = await deepScrapeNSWPlumbers();
  console.log(`\n🎉 Deep Crawler Total Discovered Leads: ${leads.length}`);

  if (leads.length > 0) {
    const csvContent = serializeUsersCsv(leads);
    const outputPath = path.join(__dirname, "..", "scratch", "all_nsw_plumbers_scraped.csv");
    fs.writeFileSync(outputPath, csvContent, "utf-8");

    const lists = await getMailingLists();
    if (!lists.some((l) => l.id === listId)) {
      await createMailingList(listName, csvContent);
    } else {
      await writeListUsersCsv(listId, leads);
    }

    console.log(`✨ Successfully updated WP Pro Mailing List '${listName}' with ${leads.length} leads.`);
  }
}

main().catch(console.error);
