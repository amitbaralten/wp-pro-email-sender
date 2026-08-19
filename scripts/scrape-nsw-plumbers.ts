import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { createMailingList } from "../lib/csv";

const NSW_PLUMBER_QUERIES = [
  "plumber Parramatta NSW Australia",
  "plumber Sydney NSW Australia",
  "plumber Penrith NSW Australia",
  "plumber Liverpool NSW Australia",
  "plumber Campbelltown NSW Australia",
  "plumber Newcastle NSW Australia",
  "plumber Wollongong NSW Australia",
  "plumber Central Coast NSW Australia",
  "plumber Blacktown NSW Australia",
  "plumber Chatswood NSW Australia",
];

async function scrapePlumbers(): Promise<UserRow[]> {
  console.log("🚀 Launching NSW Plumbers Google Maps Scraper...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--lang=en-AU,en",
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

  for (const query of NSW_PLUMBER_QUERIES) {
    console.log(`\n🔍 Searching: "${query}"...`);
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000);

      // Handle Google Cookie Consent
      try {
        const consentBtn = page.locator(
          'button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Alle akzeptieren")'
        );
        if (await consentBtn.isVisible({ timeout: 3000 })) {
          console.log("🍪 Clicking Google Consent...");
          await consentBtn.click();
          await page.waitForTimeout(1500);
        }
      } catch {
        // Consent not present
      }

      // Scroll results panel to load list items
      const feed = page.locator('div[role="feed"]');
      if (await feed.isVisible({ timeout: 5000 })) {
        for (let s = 0; s < 4; s++) {
          await feed.evaluate((el) => el.scrollBy(0, 800));
          await page.waitForTimeout(800);
        }
      }

      const cards = await page.locator('a[href*="/maps/place/"]').all();
      console.log(`📍 Found ${cards.length} listings for "${query}"`);

      for (let i = 0; i < Math.min(cards.length, 8); i++) {
        try {
          const card = cards[i];
          const ariaLabel = await card.getAttribute("aria-label");
          if (!ariaLabel || processedCompanies.has(ariaLabel.toLowerCase())) continue;
          processedCompanies.add(ariaLabel.toLowerCase());

          await card.click();
          await page.waitForTimeout(1200);

          const company = ariaLabel;

          let website = "";
          const websiteElem = page.locator('a[data-tooltip*="website"], a[aria-label*="website"]');
          if (await websiteElem.isVisible({ timeout: 1500 })) {
            website = (await websiteElem.getAttribute("href")) || "";
          }

          let address = "";
          const addressElem = page.locator('button[data-tooltip*="address"], button[aria-label*="Address"]');
          if (await addressElem.isVisible({ timeout: 1500 })) {
            address = (await addressElem.innerText()) || "";
          }

          let phone = "";
          const phoneElem = page.locator('button[data-tooltip*="phone"], button[aria-label*="Phone"]');
          if (await phoneElem.isVisible({ timeout: 1500 })) {
            phone = (await phoneElem.innerText()) || "";
          }

          let fitScore = 90;
          try {
            const ratingText = await page.locator('span[aria-label*="stars"]').first().getAttribute("aria-label");
            if (ratingText) {
              const m = ratingText.match(/([0-9.]+)\s*stars/i);
              if (m) fitScore = Math.min(100, Math.round(parseFloat(m[1]) * 20));
            }
          } catch {
            // Default fit score
          }

          // Extract Email from Plumbing Business Website
          let email = "";
          if (website && website.startsWith("http")) {
            email = await extractEmailFromWebsite(context, website);
          }

          if (!email && website) {
            try {
              const domain = new URL(website).hostname.replace(/^www\./, "");
              email = `info@${domain}`;
            } catch {
              // ignore
            }
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
              address: address || query.replace("plumber ", ""),
              title: "Business Owner / Managing Director",
              fitScore,
              fitLabel: fitScore >= 75 ? "High" : "Medium",
              linkedIn: "",
              segment: "Plumbing & Trades",
              priority: fitScore >= 80 ? "High" : "Medium",
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

            console.log(`  ✓ Scraped Plumber: ${company} | Email: ${email} | Phone: ${phone}`);
          }
        } catch (cardErr) {
          // Skip card error
        }
      }
    } catch (queryErr: unknown) {
      console.warn(`⚠️ Query "${query}" warning:`, queryErr instanceof Error ? queryErr.message : queryErr);
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailFromWebsite(context: any, url: string): Promise<string> {
  try {
    const sitePage = await context.newPage();
    await sitePage.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
    const content = await sitePage.content();

    const mailtoMatch = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch && mailtoMatch[1]) {
      await sitePage.close();
      return mailtoMatch[1].toLowerCase();
    }

    const emailMatch = content.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
    await sitePage.close();

    if (emailMatch) {
      const valid = emailMatch.find(
        (e: string) =>
          !e.endsWith(".png") &&
          !e.endsWith(".jpg") &&
          !e.endsWith(".webp") &&
          !e.includes("wixpress") &&
          !e.includes("sentry") &&
          !e.includes("domain")
      );
      if (valid) return valid.toLowerCase();
    }
  } catch {
    // Ignore website errors
  }
  return "";
}

async function main() {
  const leads = await scrapePlumbers();
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
