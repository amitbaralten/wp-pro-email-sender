import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { createMailingList } from "../lib/csv";

const REGIONS = [
  "Parramatta NSW",
  "Sydney NSW",
  "Penrith NSW",
  "Liverpool NSW",
  "Campbelltown NSW",
  "Newcastle NSW",
  "Wollongong NSW",
  "Central Coast NSW",
  "Blacktown NSW",
  "Chatswood NSW",
];

async function scrapePlumbersFast(): Promise<UserRow[]> {
  console.log("🚀 Starting Enhanced Google Maps Plumber Scraper for NSW...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--lang=en-AU",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-AU",
  });

  const page = await context.newPage();
  const leads: UserRow[] = [];
  const processedCompanies = new Set<string>();

  for (const region of REGIONS) {
    const query = `plumber ${region} Australia`;
    console.log(`\n🔍 Scraping: "${query}"...`);
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      try {
        const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
        if (await consentBtn.isVisible({ timeout: 2000 })) {
          await consentBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch {}

      const feed = page.locator('div[role="feed"]');
      if (await feed.isVisible({ timeout: 5000 })) {
        for (let i = 0; i < 4; i++) {
          await feed.evaluate((el) => el.scrollBy(0, 1000));
          await page.waitForTimeout(600);
        }
      }

      const placeLinks = page.locator('a[href*="/maps/place/"]');
      const count = await placeLinks.count();
      console.log(`📍 Found ${count} place cards for ${region}`);

      for (let i = 0; i < Math.min(count, 12); i++) {
        try {
          const linkElem = placeLinks.nth(i);
          const ariaLabel = await linkElem.getAttribute("aria-label");
          if (!ariaLabel || processedCompanies.has(ariaLabel.toLowerCase())) continue;

          await linkElem.scrollIntoViewIfNeeded();
          await linkElem.click({ force: true });
          await page.waitForTimeout(1500);

          processedCompanies.add(ariaLabel.toLowerCase());
          const company = ariaLabel;

          let website = "";
          const webBtn = page.locator('a[data-item-id="authority"], a[data-tooltip*="website"], a[aria-label*="website"]');
          if (await webBtn.count() > 0) {
            website = (await webBtn.first().getAttribute("href")) || "";
          }

          let address = region;
          const addrBtn = page.locator('button[data-item-id*="address"], button[aria-label*="Address"]');
          if (await addrBtn.count() > 0) {
            address = (await addrBtn.first().innerText()) || address;
          }

          let phone = "";
          const phoneBtn = page.locator('button[data-item-id*="phone"], button[aria-label*="Phone"]');
          if (await phoneBtn.count() > 0) {
            phone = (await phoneBtn.first().innerText()) || "";
          }

          let email = "";
          if (website && website.startsWith("http")) {
            email = await extractEmailFromDomain(context, website);
          }

          if (!email && website) {
            try {
              const domain = new URL(website).hostname.replace(/^www\./, "");
              if (domain && !domain.includes("facebook") && !domain.includes("instagram")) {
                email = `info@${domain}`;
              }
            } catch {}
          }

          if (email) {
            leads.push({
              email,
              status: "pending",
              sentAt: "",
              firstName: "",
              lastName: "",
              company,
              website,
              phone,
              address: address.replace(/\n/g, ", "),
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

            console.log(`  ✓ Scraped: ${company} | Email: ${email} | Phone: ${phone}`);
          }
        } catch (cardErr) {
        }
      }
    } catch (queryErr) {
      console.warn(` Query error for ${region}:`, queryErr);
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailFromDomain(context: any, url: string): Promise<string> {
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
          !e.includes("schema") &&
          !e.includes("domain")
      );
      if (valid) return valid.toLowerCase();
    }
  } catch {}
  return "";
}

async function main() {
  const leads = await scrapePlumbersFast();
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
