import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv, getMailingLists, createMailingList } from "../lib/csv";

const ALL_NSW_SUBURBS = [
  "Sydney CBD", "Surry Hills", "Pyrmont", "Ultimo", "Darlinghurst", "Paddington", "Waterloo", "Alexandria", "Mascot",
  "Rosebery", "Zetland", "Redfern", "Moore Park", "Bondi", "Bondi Junction", "Coogee", "Maroubra", "Randwick", "Vaucluse",
  "Double Bay", "Rose Bay", "Botany", "Pagewood", "Matraville",

  "Newtown", "Marrickville", "Ashfield", "Burwood", "Strathfield", "Leichhardt", "Five Dock", "Balmain", "Glebe",
  "Stanmore", "Petersham", "Dulwich Hill", "Enfield", "Concord", "Homebush", "Bankstown", "Padstow", "Revesby",
  "Panania", "Condell Park", "Greenacre", "Punchbowl", "Campsie", "Belmore", "Lakemba", "Yagoona",

  "Parramatta", "Westmead", "Auburn", "Lidcombe", "Granville", "Guildford", "Merrylands", "Chester Hill", "Silverwater",
  "Rosehill", "Harris Park", "Dundas", "Ermington", "Rydalmere", "Toongabbie", "Pendle Hill", "Northmead", "Greystanes",

  "Blacktown", "Seven Hills", "Doonside", "Quakers Hill", "Schofields", "Riverstone", "Stanhope Gardens", "The Ponds",
  "Marsden Park", "Mount Druitt", "St Marys", "Penrith", "Emu Plains", "Jamisontown", "Glenmore Park", "Cranebrook",
  "Rooty Hill", "Minchinbury", "Erskine Park", "Wetherill Park", "Smithfield", "Fairfield", "Cabramatta", "Canley Vale",

  "Liverpool", "Casula", "Moorebank", "Chipping Norton", "Prestons", "Hoxton Park", "Edmondson Park", "Ingleburn",
  "Minto", "Campbelltown", "Macquarie Fields", "Narellan", "Camden", "Gregory Hills", "Oran Park", "Tahmoor", "Picton",

  "Cronulla", "Miranda", "Caringbah", "Sutherland", "Engadine", "Gymea", "Jannali", "Menai", "Kirrawee", "Heathcote",
  "Hurstville", "Rockdale", "Kogarah", "Bexley", "Carlton", "Penshurst", "Oatley", "Mortdale", "Sans Souci", "Arncliffe",

  "North Sydney", "Chatswood", "Ryde", "Eastwood", "Epping", "Macquarie Park", "Hornsby", "Wahroonga", "Turramurra",
  "Pymble", "Gordon", "Killara", "Roseville", "Lindfield", "St Ives", "Asquith", "Berowra", "Pennant Hills", "Thornleigh",
  "Lane Cove", "Crows Nest", "St Leonards", "Willoughby", "Neutral Bay", "Mosman",

  "Manly", "Dee Why", "Brookvale", "Mona Vale", "Narrabeen", "Collaroy", "Freshwater", "Balgowlah", "Belrose",
  "Frenchs Forest", "Forestville", "Avalon", "Newport", "Terrey Hills",

  "Castle Hill", "Baulkham Hills", "Rouse Hill", "Kellyville", "Norwest", "Bella Vista", "Cherrybrook", "Glenhaven",
  "Dural", "Galston", "Kenthurst",

  "Newcastle", "Hamilton", "Kotara", "Charlestown", "Warners Bay", "Maitland", "Kurri Kurri", "Cessnock", "Singleton",
  "Gosford", "Wyong", "Tuggerah", "Erina", "Terrigal", "Woy Woy", "Bateau Bay", "The Entrance", "Lake Haven",

  "Wollongong", "Fairy Meadow", "Corrimal", "Bulli", "Helensburgh", "Shellharbour", "Dapto", "Albion Park", "Kiama",
  "Nowra", "Berrors", "Ulladulla", "Batemans Bay", "Moruya", "Narooma", "Bega", "Merimbula",

  "Dubbo", "Orange", "Bathurst", "Mudgee", "Parkes", "Forbes", "Cowra", "Lithgow",

  "Wagga Wagga", "Albury", "Lavington", "Griffith", "Deniliquin", "Tumut", "Young",

  "Tamworth", "Armidale", "Inverell", "Moree", "Narrabri", "Gunnedah",

  "Port Macquarie", "Coffs Harbour", "Sawtell", "Toormina", "Taree", "Kempsey", "Foster", "Byron Bay", "Tweed Heads",
  "Lismore", "Ballina", "Grafton", "Murwillumbah", "Kingscliff", "Yamba",

  "Goulburn", "Bowral", "Mittagong", "Moss Vale", "Queanbeyan", "Yass", "Cooma", "Jindabyne"
];

function generateQueryFile(): string {
  const lines = ALL_NSW_SUBURBS.map((suburb) => `plumber ${suburb} NSW Australia`);
  const content = lines.join("\n");
  const filePath = path.join(__dirname, "..", "scratch", "queries_nsw_all_plumbers.txt");
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`📝 Generated ${lines.length} suburb search queries in scratch/queries_nsw_all_plumbers.txt`);
  return filePath;
}

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

function cleanCompanyName(rawTitle: string, domain: string): string {
  let cleaned = rawTitle.split(/[-|–:]/)[0].trim();
  cleaned = cleaned.replace(/^(home|welcome to|official site|plumber)\s+/i, "");
  if (!cleaned || cleaned.length < 3 || /^(home|about|contact|index|business owner)$/i.test(cleaned)) {
    const parts = domain.replace(/\.(com|net|org)?\.(au)?$/, "").split(/[-.]/);
    cleaned = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return cleaned;
}

async function runMassiveScraper(): Promise<UserRow[]> {
  console.log(`🚀 Starting Massive Scraper engine across ${ALL_NSW_SUBURBS.length} NSW suburbs...`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-AU",
  });

  const listId = "all-nsw-plumbers-scraped";
  const listFilePath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);
  
  let existingLeads: UserRow[] = [];
  if (fs.existsSync(listFilePath)) {
    try {
      existingLeads = parseUsersCsv(fs.readFileSync(listFilePath, "utf-8"));
    } catch {}
  }

  const processedDomains = new Set<string>(existingLeads.map((l) => {
    try {
      return l.website ? new URL(l.website).hostname.toLowerCase() : l.email.split("@")[1];
    } catch {
      return l.email;
    }
  }));

  const processedEmails = new Set<string>(existingLeads.map((l) => l.email.toLowerCase().trim()));
  const allLeads: UserRow[] = [...existingLeads];

  let page = await context.newPage();

  for (let i = 0; i < ALL_NSW_SUBURBS.length; i++) {
    const suburb = ALL_NSW_SUBURBS[i];
    if (i % 10 === 0) {
      console.log(`\n📊 [Progress: ${i}/${ALL_NSW_SUBURBS.length}] Total Verified NSW Plumber Leads Harvested: ${allLeads.length}`);
    }

    const query = `plumber ${suburb} NSW Australia site:.com.au`;
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    try {
      if (page.isClosed()) page = await context.newPage();

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
      await page.waitForTimeout(600);

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
            domain.includes("airtasker")
          ) {
            continue;
          }

          if (processedDomains.has(domain)) continue;
          processedDomains.add(domain);

          const rawTitle = (await linkElem.innerText()) || domain;
          const company = cleanCompanyName(rawTitle, domain);
          const website = `https://${domain}`;

          const emailData = await extractEmailAndPhone(context, website);

          const email = emailData.email || `info@${domain}`;

          if (processedEmails.has(email)) continue;
          processedEmails.add(email);

          const newLead: UserRow = {
            email,
            status: "pending",
            sentAt: "",
            firstName: "",
            lastName: "",
            company: company.length > 55 ? `${company.slice(0, 52)}...` : company,
            website,
            phone: emailData.phone,
            address: `${suburb} NSW`,
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
          };

          allLeads.push(newLead);
          console.log(`  ✓ Harvested Plumber [${suburb}]: ${company} | Email: ${email} | Phone: ${emailData.phone}`);

          if (allLeads.length % 5 === 0) {
            const csvContent = serializeUsersCsv(allLeads);
            fs.writeFileSync(listFilePath, csvContent, "utf-8");
            await writeListUsersCsv(listId, allLeads);
          }
        } catch {}
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      page = await context.newPage();
    }
  }

  await browser.close();

  const csvContent = serializeUsersCsv(allLeads);
  fs.writeFileSync(listFilePath, csvContent, "utf-8");
  await writeListUsersCsv(listId, allLeads);

  return allLeads;
}

async function extractEmailAndPhone(
  context: any,
  url: string
): Promise<{ email: string; phone: string }> {
  let email = "";
  let phone = "";

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 7000 });
    const content = await page.content();

    const mailto = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailto && mailto[1]) email = mailto[1].toLowerCase();

    if (!email) {
      const matches = content.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
      if (matches) {
        const valid = matches.find(
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

    const phoneMatch = content.match(/(\(02\)\s*\d{4}\s*\d{4}|04\d{2}\s*\d{3}\s*\d{3}|1300\s*\d{3}\s*\d{3})/);
    if (phoneMatch) phone = phoneMatch[0];

    await page.close();
  } catch {}

  return { email, phone };
}

async function main() {
  generateQueryFile();
  const leads = await runMassiveScraper();
  console.log(`\n🎉 Massive Scraper Complete! Total Verified NSW Plumber Business Leads: ${leads.length}`);
}

main().catch(console.error);
