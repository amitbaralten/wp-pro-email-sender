import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { createMailingList } from "../lib/csv";

async function scrapeGoogleMaps(query: string, maxResults = 15): Promise<UserRow[]> {
  console.log(`🔍 Starting Google Maps scrape for: "${query}"...`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-AU",
  });

  const page = await context.newPage();

  // Search URL
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });

  // Handle Google Consent Dialog if present
  try {
    const consentButton = page.locator(
      'button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Alle akzeptieren")'
    );
    if (await consentButton.isVisible({ timeout: 4000 })) {
      console.log("🍪 Clicking Google Consent button...");
      await consentButton.click();
      await page.waitForTimeout(2000);
    }
  } catch {
    // Consent not found, proceed
  }

  // Wait for results feed panel
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
  } catch {
    console.log("⚠️ Could not find Google Maps feed panel.");
  }

  // Scroll down feed panel to load items
  const feed = page.locator('div[role="feed"]');
  for (let i = 0; i < 5; i++) {
    if (await feed.isVisible()) {
      await feed.evaluate((el) => el.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }
  }

  // Extract business cards
  const cards = await page.locator('a[href*="/maps/place/"]').all();
  console.log(`📍 Found ${cards.length} business places on Google Maps.`);

  const leads: UserRow[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < Math.min(cards.length, maxResults); i++) {
    try {
      const card = cards[i];
      const ariaLabel = await card.getAttribute("aria-label");
      if (!ariaLabel || processed.has(ariaLabel)) continue;
      processed.add(ariaLabel);

      await card.click();
      await page.waitForTimeout(1500);

      // Extract details from side drawer
      const company = ariaLabel;
      
      // Website link
      let website = "";
      const websiteElem = page.locator('a[data-tooltip*="website"], a[aria-label*="website"]');
      if (await websiteElem.isVisible()) {
        website = (await websiteElem.getAttribute("href")) || "";
      }

      // Address
      let address = "";
      const addressElem = page.locator('button[data-tooltip*="address"], button[aria-label*="Address"]');
      if (await addressElem.isVisible()) {
        address = (await addressElem.innerText()) || "";
      }

      // Phone
      let phone = "";
      const phoneElem = page.locator('button[data-tooltip*="phone"], button[aria-label*="Phone"]');
      if (await phoneElem.isVisible()) {
        phone = (await phoneElem.innerText()) || "";
      }

      // Category
      let category = query.split(" ")[0] || "Business";
      const categoryElem = page.locator('button[jsaction*="category"]');
      if (await categoryElem.isVisible()) {
        category = (await categoryElem.innerText()) || category;
      }

      // Rating
      let fitScore: number | null = 85;
      try {
        const ratingText = await page.locator('span[aria-label*="stars"]').first().getAttribute("aria-label");
        if (ratingText) {
          const match = ratingText.match(/([0-9.]+)\s*stars/i);
          if (match) {
            fitScore = Math.min(100, Math.round(parseFloat(match[1]) * 20));
          }
        }
      } catch {
        // Default fit score
      }

      // Extract Email from Website
      let email = "";
      if (website && website.startsWith("http")) {
        email = await extractEmailFromWebsite(context, website);
      }

      // Fallback domain email if not scraped directly
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
          address,
          title: "Owner / Director",
          fitScore,
          fitLabel: fitScore && fitScore >= 75 ? "High" : "Medium",
          linkedIn: "",
          segment: category,
          priority: fitScore && fitScore >= 80 ? "High" : "Medium",
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

        console.log(`  ✓ Scraped Lead: ${company} | Email: ${email} | Category: ${category}`);
      }
    } catch (e: unknown) {
      console.warn(`  ⚠️ Error processing card ${i + 1}:`, e instanceof Error ? e.message : e);
    }
  }

  await browser.close();
  return leads;
}

async function extractEmailFromWebsite(context: any, url: string): Promise<string> {
  try {
    const sitePage = await context.newPage();
    await sitePage.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
    const content = await sitePage.content();
    await sitePage.close();

    // Mailto regex
    const mailtoMatch = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch && mailtoMatch[1]) {
      return mailtoMatch[1].toLowerCase();
    }

    // Generic email regex
    const emailMatch = content.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
    if (emailMatch) {
      const valid = emailMatch.find(
        (e: string) =>
          !e.endsWith(".png") &&
          !e.endsWith(".jpg") &&
          !e.endsWith(".webp") &&
          !e.includes("wixpress") &&
          !e.includes("sentry")
      );
      if (valid) return valid.toLowerCase();
    }
  } catch {
    // ignore website fetch errors
  }
  return "";
}

async function main() {
  const query = process.argv[2] || "NDIS provider Parramatta NSW Australia";
  const listName = process.argv[3] || "NDIS Parramatta Scraped";

  console.log(`🚀 Starting direct Playwright Google Maps scraper for "${query}"...\n`);

  const leads = await scrapeGoogleMaps(query, 10);
  console.log(`\n🎉 Total Scraped Leads with Emails: ${leads.length}`);

  if (leads.length > 0) {
    const csvContent = serializeUsersCsv(leads);
    const outputPath = path.join(__dirname, "..", "scratch", "scraped_leads.csv");
    fs.writeFileSync(outputPath, csvContent, "utf-8");
    console.log(`📁 Saved to: ${outputPath}`);

    const createdList = await createMailingList(listName, csvContent);
    console.log(`✨ Created WP Pro Mailing List: ID='${createdList.id}', Name='${createdList.name}'`);
  }
}

main().catch(console.error);
