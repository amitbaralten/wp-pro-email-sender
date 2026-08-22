import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { writeListUsersCsv } from "../lib/csv";
import { isOpenRouterConfigured, prompt } from "../lib/openrouter";

const NEEDS_CLEANUP = /business owner|managing director|home|about|contact|owner|director|undefined|null/i;

/** True when a company value looks machine/domain-derived rather than a real, readable name. */
function shouldClean(company: string): boolean {
  if (!company) return true;
  if (NEEDS_CLEANUP.test(company)) return true;

  // Trailing TLD artifacts left by domain formatting, e.g. "Plumbersden Com".
  if (/\b(com|net|org|au|co|io)$/i.test(company)) return true;

  // A single long run of characters with no space is almost always a squashed domain.
  const words = company.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length >= 10) return true;
  if (words.some((w) => w.length >= 16)) return true;

  return false;
}

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

  const base = domain.replace(/\.(com|net|org)?\.(au)?$/, "").replace(/\/.*$/, "");
  const parts = base.split(/[-._]/).filter(Boolean);

  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Asks ox-alpha (via OpenRouter) for a clean business name, falling back to the
 * domain-derived name on any error or when OpenRouter is not configured.
 */
async function cleanCompanyNameWithLLM(user: UserRow): Promise<string> {
  const fallback = formatDomainToCompanyName(user.email, user.website);
  if (!isOpenRouterConfigured()) return fallback;

  try {
    // ox-alpha is a reasoning model: max_tokens covers reasoning + answer, so keep headroom.
    const result = await prompt(
      "You clean up business names for cold email personalization. Reply with ONLY the proper business name, no quotes, no extra words.",
      `Email: ${user.email}\nWebsite: ${user.website || "(none)"}\nRaw company field: ${user.company || "(empty)"}\n\nReturn the best human-readable business name.`,
      { maxTokens: 300 }
    );
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    return cleaned || fallback;
  } catch (err) {
    console.warn(`  ⚠️  LLM cleanup failed for ${user.email}, using fallback:`, (err as Error).message);
    return fallback;
  }
}

async function enhanceList(listId: string) {
  const filePath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);
  if (!fs.existsSync(filePath)) return;

  const rawText = fs.readFileSync(filePath, "utf-8");
  const users = parseUsersCsv(rawText);

  const useLLM = isOpenRouterConfigured();
  console.log(
    `✨ Enhancing company names for ${users.length} unique leads in '${listId}'${useLLM ? " (using ox-alpha)" : ""}...`
  );

  const updatedUsers: UserRow[] = [];
  let cleaned = 0;
  for (const u of users) {
    let company = u.company.trim();

    if (shouldClean(company)) {
      company = await cleanCompanyNameWithLLM(u);
      cleaned++;
      if (cleaned % 25 === 0) console.log(`  … ${cleaned} cleaned so far`);
    }

    updatedUsers.push({ ...u, company });
  }

  const serialized = serializeUsersCsv(updatedUsers);
  fs.writeFileSync(filePath, serialized, "utf-8");
  await writeListUsersCsv(listId, updatedUsers);

  console.log(`🎉 Cleaned ${cleaned}/${updatedUsers.length} company names in '${listId}'!`);
}

async function main() {
  await enhanceList("google-maps-plumbers");
  await enhanceList("all-nsw-plumbers-scraped");
  await enhanceList("nsw-plumbers-scraped");
}

main().catch(console.error);
