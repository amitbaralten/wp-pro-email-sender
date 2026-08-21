import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv } from "../lib/csv";

async function main() {
  const listId = "all-nsw-plumbers-scraped";
  const filePath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);

  if (!fs.existsSync(filePath)) {
    console.log("No list file found to clean.");
    return;
  }

  const rawText = fs.readFileSync(filePath, "utf-8");
  const users = parseUsersCsv(rawText);

  console.log(`🧹 Cleaning ${users.length} raw scraped plumber leads...`);

  const validLeads: UserRow[] = [];
  const seenEmails = new Set<string>();

  for (const u of users) {
    const email = u.email.toLowerCase().trim();
    if (!email || seenEmails.has(email)) continue;

    const domain = u.website ? new URL(u.website).hostname.toLowerCase() : email.split("@")[1];
    
    if (/\.(jp|id|cc|cn|ru|de|fr|br|kr)$/i.test(domain) || /\.(jp|id|cc|cn|ru|de|fr|br|kr)$/i.test(email)) {
      continue;
    }

    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/i.test(u.company)) {
      continue;
    }

    const isAu = domain.endsWith(".au") || domain.endsWith(".sydney") || domain.endsWith(".melbourne");
    const isPlumbingRelated = /plumb|drain|flow|pipe|roof|water|gas|hvac|fitout|build|trade|emergency/i.test(
      `${domain} ${u.company}`
    );

    if (isAu || isPlumbingRelated) {
      seenEmails.add(email);
      validLeads.push({
        ...u,
        segment: "Plumbing & Trades",
        priority: "High",
        fitScore: 92,
        fitLabel: "High",
      });
    }
  }

  console.log(`✅ Cleaned dataset contains ${validLeads.length} high-quality Australian plumber leads!`);

  const serialized = serializeUsersCsv(validLeads);
  fs.writeFileSync(filePath, serialized, "utf-8");

  await writeListUsersCsv(listId, validLeads);
  console.log(`✨ Updated list '${listId}' with ${validLeads.length} verified Australian plumber leads.`);
}

main().catch(console.error);
