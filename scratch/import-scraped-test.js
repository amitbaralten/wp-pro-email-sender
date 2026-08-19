const fs = require("fs");
const path = require("path");
const { createMailingList, parseUsersCsv } = require("../lib/csv");
const { buildEmailSubject } = require("../lib/email-template");

async function main() {
  console.log("🧪 Testing Google Maps Scraper CSV Auto-Mapper & Mailing List Creation...\n");

  const csvPath = path.join(__dirname, "scraped_parramatta_leads.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");

  const parsed = parseUsersCsv(csvText);
  console.log(`✅ Parsed ${parsed.length} scraped Google Business leads:`);

  parsed.forEach((lead, i) => {
    console.log(`\n--- Lead ${i + 1} ---`);
    console.log(`🏢 Company:  ${lead.company}`);
    console.log(`✉️  Email:    ${lead.email}`);
    console.log(`📍 Location: ${lead.address}`);
    console.log(`🏷️  Category: ${lead.segment}`);
    console.log(`⭐ FitScore: ${lead.fitScore} (${lead.fitLabel})`);

    const subject = buildEmailSubject(lead);
    console.log(`📩 Subject:  ${subject}`);
  });

  const newList = await createMailingList("Parramatta Scraped Google Businesses", csvText);
  console.log(`\n🎉 Created Mailing List: ID='${newList.id}', Name='${newList.name}', Total Leads=${newList.totalLeads}`);
}

main().catch(console.error);
