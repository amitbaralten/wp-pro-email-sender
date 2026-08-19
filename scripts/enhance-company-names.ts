import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv } from "../lib/csv";

function formatDomainToCompanyName(email: string, website: string): string {
  let domain = "";
  try {
    if (website && website.startsWith("http")) {
      domain = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    } else {
      domain = email.split("@")[1] || "";
    }
  } catch {
    domain = email.split("@")[1] || "";
  }

  // Remove common TLDs
  const base = domain.replace(/\.(com|net|org)?\.(au)?$/, "").replace(/\/.*$/, "");
  const parts = base.split(/[-._]/).filter(Boolean);

  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function enhanceList(listId: string) {
  const filePath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);
  if (!fs.existsSync(filePath)) return;

  const rawText = fs.readFileSync(filePath, "utf-8");
  const users = parseUsersCsv(rawText);

  console.log(`✨ Enhancing company names for ${users.length} unique leads in '${listId}'...`);

  const updatedUsers: UserRow[] = users.map((u) => {
    let company = u.company.trim();

    // Check if company name is generic or missing
    if (
      !company ||
      /business owner|managing director|home|about|contact|owner|director|undefined|null/i.test(company)
    ) {
      company = formatDomainToCompanyName(u.email, u.website);
    }

    return {
      ...u,
      company,
    };
  });

  const serialized = serializeUsersCsv(updatedUsers);
  fs.writeFileSync(filePath, serialized, "utf-8");
  await writeListUsersCsv(listId, updatedUsers);

  console.log(`🎉 Updated company names for all ${updatedUsers.length} leads in '${listId}'!`);
}

async function main() {
  await enhanceList("google-maps-plumbers");
  await enhanceList("all-nsw-plumbers-scraped");
  await enhanceList("nsw-plumbers-scraped");
}

main().catch(console.error);
