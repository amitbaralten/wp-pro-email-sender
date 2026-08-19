export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9.+\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

export function cleanCompanyName(company?: string): string {
  if (!company) return "";
  return company
    .replace(/\b(Pty\s*Ltd|Pty|Ltd|Inc|LLC|Corporation|Corp|Co)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSuburb(address: string): string {
  if (!address) return "";
  // Split comma or newline
  const parts = address.split(/,|\n/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "";
  
  // Try finding part that matches Australian Suburb/City patterns or take part before state/postcode
  for (const part of parts) {
    const cleaned = part.replace(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s*\d{4}\b/gi, "").trim();
    if (cleaned && !/^\d+/.test(cleaned) && cleaned.length < 30) {
      return cleaned;
    }
  }
  return parts[0] || "";
}

export function isGenericEmail(email: string): boolean {
  const prefix = email.split("@")[0]?.toLowerCase() || "";
  const genericPrefixes = [
    "info", "admin", "contact", "hello", "sales", "support",
    "enquiries", "inquiries", "office", "help", "reception", "team"
  ];
  return genericPrefixes.includes(prefix);
}

export function detectBusinessType(email: string, company: string): string {
  const text = `${email} ${company}`.toLowerCase();

  if (/ndis|disability|support\s*worker|care\s*provider|sil|plan\s*manager|support\s*coordinat/i.test(text)) {
    return "ndis & disability support";
  }
  if (/real\s*estate|realty|property|properties|agents|rentals|raywhite|century21|mcgrath|ljhooker|domain/i.test(text)) {
    return "real estate";
  }
  if (/law|legal|solicitor|barrister|attorney|conveyancing|chambers|paralegal/i.test(text)) {
    return "legal";
  }
  if (/finance|wealth|broker|mortgage|capital|advisory|financial|invest/i.test(text)) {
    return "finance";
  }
  if (/construct|builder|building|plumb|electric|roof|hvac|solar|paving|landscape|trade|fitout|carpentry/i.test(text)) {
    return "construction & trades";
  }
  if (/health|clinic|dental|dentist|chiro|physio|medical|doctor|care|wellness|pharma/i.test(text)) {
    return "healthcare";
  }
  if (/account|tax|bookkeep|cpa|audit/i.test(text)) {
    return "accounting & advisory";
  }
  if (/recruit|talent|hr|staffing|hiring|search/i.test(text)) {
    return "recruitment";
  }
  if (/hotel|restaurant|cafe|catering|venue|hospitality|bar/i.test(text)) {
    return "hospitality";
  }
  if (/shop|store|boutique|retail|brand|apparel|fashion|cart|ecommerce/i.test(text)) {
    return "ecommerce & retail";
  }

  return "business";
}
