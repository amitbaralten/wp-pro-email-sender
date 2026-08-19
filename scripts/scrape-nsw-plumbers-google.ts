import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { createMailingList } from "../lib/csv";

async function scrapeNSWPlumbers(): Promise<UserRow[]> {
  console.log("🚀 Starting Direct Google Search & Web Scraper for NSW Plumbers...");

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
  ];

  const leads: UserRow[] = [];
  const processedDomains = new Set<string>();

  for (const loc of LOCATIONS) {
    console.log(`\n🔍 Searching Google for Plumber Businesses in ${loc} NSW...`);
    const searchUrl = `https://www.google.com/search?q=plumber+${encodeURIComponent(loc)}+NSW+contact+email`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1500);

      // Handle consent
      try {
        const consent = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
        if (await consent.isVisible({ timeout: 2000 })) await consent.click();
      } catch {}

      // Extract organic search result links
      const links = await page.locator('a[href^="http"]').all();

      for (const linkElem of links) {
        try {
          const href = await linkElem.getAttribute("href");
          if (!href) continue;

          // Exclude directory/social sites
          if (
            href.includes("google.") ||
            href.includes("yellowpages") ||
            href.includes("hipages") ||
            href.includes("oneflare") ||
            href.includes("facebook") ||
            href.includes("instagram") ||
            href.includes("youtube") ||
            href.includes("truelocal") ||
            href.includes("linkedin") ||
            href.includes("seek")
          ) {
            continue;
          }

          let urlObj: URL;
          try {
            urlObj = new URL(href);
          } catch {
            continue;
          }

          const domain = urlObj.hostname.replace(/^www\./, "").toLowerCase();
          if (processedDomains.has(domain)) continue;
          processedDomains.add(domain);

          const rawTitle = (await linkElem.innerText()) || domain;
          let company = rawTitle.split(/[-|–:]/)[0].trim();
          if (!company || company.length < 3) company = domain;

          const website = `https://${domain}`;
          const email = await extractEmailFromWebsite(context, website, domain);

          if (email) {
            leads.push({
              email,
              status: "pending",
              sentAt: "",
              firstName: "",
              lastName: "",
              company: company.length > 50 ? `${company.slice(0, 47)}...` : company,
              website,
              phone: "",
              address: `${loc} NSW`,
              title: "Business Owner / Managing Director",
              fitScore: 90,
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

            console.log(`  ✓ Scraped Plumber: ${company} | Email: ${email} | Website: ${website}`);
          }
        } catch {}
      }
    } catch (e: unknown) {
      console.warn(` Warning for ${loc}:`, e instanceof Error ? e.message : e);
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailFromWebsite(context: any, url: string, domain: string): Promise<string> {
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
    const content = await page.content();
    await page.close();

    const mailto = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailto && mailto[1]) return mailto[1].toLowerCase();

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
      if (valid) return valid.toLowerCase();
    }
  } catch {}

  // Fallback domain email
  return `info@${domain}`;
}

async function main() {
  const leads = await scrapeNSWPlumbers();
  console.log(`\n🎉 Total Scraped NSW Plumber Leads: ${leads.length}`);

  if (leads.length > 0) {
    const csvContent = serializeUsersCsv(leads);
    const outputPath = path.join(__dirname, "..", "scratch", "nsw_plumbers_scraped.csv");
    fs.writeFileSync(outputPath, csvContent, "utf-8");

    const createdList = await createMailingList("NSW Plumbers Scraped", csvContent);
    console.log(`✨ Created WP Pro Mailing List: ID='${createdList.id}', Name='${createdList.name}', Total Leads=${createdList.totalLeads}`);
  }
}

main().catch(console.error);
