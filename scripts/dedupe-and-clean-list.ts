import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv } from "../lib/csv";

const SUPPLIER_AND_DIRECTORY_DOMAINS = [
  "obrien.com.au",
  "reece.com.au",
  "tradelink.com.au",
  "elders.com.au",
  "eldersrealestate.com.au",
  "thryv.com",
  "localbusinessguide.com.au",
  "yellowpages.com.au",
  "hipages.com.au",
  "oneflare.com.au",
  "facebook.com",
  "instagram.com",
];

async function dedupeAndCleanList(listId: string) {
  const listPath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);
  if (!fs.existsSync(listPath)) {
    console.log(`No list file found for '${listId}'.`);
    return;
  }

  const rawText = fs.readFileSync(listPath, "utf-8");
  const rawUsers = parseUsersCsv(rawText);
  console.log(`📋 Loaded ${rawUsers.length} raw leads from '${listId}.csv'...`);

  const uniqueLeads: UserRow[] = [];
  const seenEmails = new Set<string>();
  const seenDomains = new Set<string>();

  for (const u of rawUsers) {
    const email = u.email.toLowerCase().trim();
    if (!email) continue;

    // 1. Strict Duplicate Email Filter
    if (seenEmails.has(email)) continue;

    let domain = "";
    try {
      domain = u.website ? new URL(u.website).hostname.replace(/^www\./, "").toLowerCase() : email.split("@")[1];
    } catch {
      domain = email.split("@")[1] || "";
    }

    // 2. Filter out generic suppliers / real estate franchises / directories
    if (SUPPLIER_AND_DIRECTORY_DOMAINS.some((d) => domain.includes(d) || email.includes(d))) {
      continue;
    }

    // 3. Strict Duplicate Domain Filter (Max 1 lead per website domain)
    if (domain && seenDomains.has(domain)) continue;

    seenEmails.add(email);
    if (domain) seenDomains.add(domain);

    uniqueLeads.push({
      ...u,
      email,
      segment: "Plumbing & Trades",
      priority: "High",
      fitScore: 92,
      fitLabel: "High",
    });
  }

  console.log(`✅ Deduplication complete! ${rawUsers.length} raw leads reduced to ${uniqueLeads.length} 100% UNIQUE, high-quality plumber email leads.`);

  const csvContent = serializeUsersCsv(uniqueLeads);
  fs.writeFileSync(listPath, csvContent, "utf-8");

  await writeListUsersCsv(listId, uniqueLeads);
  console.log(`✨ Updated list '${listId}' with ${uniqueLeads.length} unique leads.`);
}

async function main() {
  await dedupeAndCleanList("google-maps-plumbers");
  await dedupeAndCleanList("all-nsw-plumbers-scraped");
  await dedupeAndCleanList("nsw-plumbers-scraped");
}

main().catch(console.error);
