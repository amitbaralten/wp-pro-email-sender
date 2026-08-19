import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-AU",
  });
  const page = await context.newPage();

  await page.goto("https://www.google.com/search?q=plumber+Parramatta+NSW", { waitUntil: "domcontentloaded" });

  // Handle consent
  try {
    const consent = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
    if (await consent.isVisible({ timeout: 2000 })) await consent.click();
  } catch {}

  const anchors = await page.locator('a').all();
  console.log(`Total anchors found on page: ${anchors.length}`);

  let found = 0;
  for (const a of anchors) {
    const href = await a.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("http") && !href.includes("google.com")) {
      const text = await a.innerText();
      console.log(`Found direct URL: ${href} | Text: ${text.slice(0, 40)}`);
      found++;
    } else if (href.includes("/url?q=http")) {
      const actual = decodeURIComponent(href.split("/url?q=")[1].split("&")[0]);
      if (!actual.includes("google.com")) {
        const text = await a.innerText();
        console.log(`Found Google redirect URL: ${actual} | Text: ${text.slice(0, 40)}`);
        found++;
      }
    }
  }

  console.log(`\n🎉 Total valid URLs extracted: ${found}`);
  await browser.close();
}

main().catch(console.error);
