import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("🔍 Searching Bing for: plumber Parramatta NSW...");
  await page.goto("https://www.bing.com/search?q=plumber+Parramatta+NSW+Australia", { waitUntil: "domcontentloaded" });

  const links = await page.locator("li.b_algo h2 a").all();
  console.log(`📍 Found ${links.length} organic business search results on Bing:`);

  for (const l of links) {
    const href = await l.getAttribute("href");
    const title = await l.innerText();
    console.log(`  ✓ ${title} | ${href}`);
  }

  await browser.close();
}

main().catch(console.error);
