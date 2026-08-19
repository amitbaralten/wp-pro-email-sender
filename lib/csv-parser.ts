import { isValidEmail } from "@/lib/email-utils";

export { isValidEmail } from "@/lib/email-utils";

export type UserStatus = "pending" | "sent";

export type DeliveryStatus =
  | ""
  | "queued"
  | "scheduled"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed"
  | "complained"
  | "suppressed"
  | "canceled"
  | "opened"
  | "clicked";

export interface UserRow {
  email: string;
  status: UserStatus;
  sentAt: string;       // ISO date string (YYYY-MM-DD)
  firstName: string;
  lastName: string;
  company: string;
  website: string;
  phone: string;
  address: string;      // mapped from Location, full_address, address
  title: string;
  fitScore: number | null;
  fitLabel: string;
  linkedIn: string;     // LinkedIn URL
  segment: string;      // Category / Industry (e.g. Real Estate, Legal)
  priority: string;     // e.g. "High"
  emailType: string;
  resendId: string;
  resendStatus: string;
  deliveryStatus: DeliveryStatus;
  resendCreatedAt: string;
  resendScheduledAt: string;
  resendLastSyncedAt: string;
  resendSubject: string;
  resendFrom: string;
  resendTo: string;
  resendError: string;
}

export interface MailingListMeta {
  id: string;
  name: string;
  createdAt: string;
  totalLeads: number;
  sentCount: number;
}

export const OUTPUT_HEADERS = [
  "Email", "First Name", "Last Name", "Company", "Website", "Phone", "Address",
  "Title", "fitScore", "fitLabel", "status", "sentAt",
  "LinkedIn", "Segment", "Priority", "EmailType",
  "resendId", "resendStatus", "deliveryStatus", "resendCreatedAt", "resendScheduledAt",
  "resendLastSyncedAt", "resendSubject", "resendFrom", "resendTo", "resendError",
];

const DELIVERY_STATUSES: DeliveryStatus[] = [
  "",
  "queued",
  "scheduled",
  "sent",
  "delivered",
  "delivery_delayed",
  "bounced",
  "failed",
  "complained",
  "suppressed",
  "canceled",
  "opened",
  "clicked",
];

const DELIVERY_STATUS_SET = new Set<string>(DELIVERY_STATUSES);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function escapeCsvCell(value: string): string {
  const normalized = (value ?? "").replace(/\r?\n/g, " ").trim();
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

/** Robust CSV parser supporting standard leads AND gosom/google-maps-scraper outputs */
export function parseUsersCsv(csvText: string): UserRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

  const idx = (...names: string[]) => {
    for (const name of names) {
      const i = headers.indexOf(name);
      if (i !== -1) return i;
    }
    return -1;
  };

  // Standard & Google Maps Scraper column aliases
  const emailIdx   = idx("email", "emails", "e-mail", "mail");
  const firstIdx   = idx("first name", "firstname", "first_name");
  const lastIdx    = idx("last name", "lastname", "last_name");
  const companyIdx = idx("company", "company name", "company_name", "business_name", "name", "organisation", "organization");
  const websiteIdx = idx("website", "link", "url", "website url");
  const phoneIdx   = idx("phone", "phone_number", "mobile", "telephone");
  const addressIdx = idx("full_address", "address", "location", "full address", "city", "address1");
  const titleIdx   = idx("job_title", "position", "job title", "title");
  const scoreIdx   = idx("rating", "fitscore", "fit score", "fit_score", "score");
  const labelIdx   = idx("fitlabel", "fit label", "fit_label", "label");
  const statusIdx  = idx("status");
  const sentAtIdx  = idx("sentat", "sent_at", "sent at");
  const linkedInIdx = idx("linkedin", "linkedin url", "linkedin_url");
  const segmentIdx  = idx("category", "categories", "types", "segment");
  const priorityIdx = idx("priority");
  const emailTypeIdx = idx("email type", "email_type", "emailtype");
  const resendIdIdx = idx("resendid", "resend_id", "resend id");
  const resendStatusIdx = idx("resendstatus", "resend_status", "resend status");
  const deliveryStatusIdx = idx("deliverystatus", "delivery_status", "delivery status");
  const resendCreatedAtIdx = idx("resendcreatedat", "resend_created_at", "resend created at");
  const resendScheduledAtIdx = idx("resendscheduledat", "resend_scheduled_at", "resend scheduled at");
  const resendLastSyncedAtIdx = idx("resendlastsyncedat", "resend_last_synced_at", "resend last synced at");
  const resendSubjectIdx = idx("resendsubject", "resend_subject", "resend subject");
  const resendFromIdx = idx("resendfrom", "resend_from", "resend from");
  const resendToIdx = idx("resendto", "resend_to", "resend to");
  const resendErrorIdx = idx("resenderror", "resend_error", "resend error");

  if (emailIdx === -1) {
    throw new Error("CSV must contain an 'Email' or 'emails' column.");
  }

  return dataLines
    .map((line) => parseCsvLine(line))
    .map((cols): UserRow | null => {
      const get = (i: number) => (i >= 0 ? (cols[i] ?? "").trim() : "");
      let email = get(emailIdx);

      // Fallback domain email from website if email column is empty (e.g. when Fetch Emails was unchecked)
      if (!email && websiteIdx !== -1) {
        const site = get(websiteIdx);
        if (site && site.startsWith("http")) {
          try {
            const domain = new URL(site).hostname.replace(/^www\./, "").toLowerCase();
            if (domain && !domain.includes("facebook") && !domain.includes("instagram") && !domain.includes("google")) {
              email = `info@${domain}`;
            }
          } catch {}
        }
      }

      if (!email) return null;

      if (email.includes(",") || email.includes(";")) {
        const parts = email.split(/[,;]/).map((e) => e.trim());
        const valid = parts.find((e) => isValidEmail(e));
        if (valid) email = valid;
      }
      if (!isValidEmail(email)) return null;

      const rawScore = get(scoreIdx);
      let fitScore: number | null = null;
      if (rawScore !== "") {
        const parsed = parseFloat(rawScore);
        if (!isNaN(parsed)) {
          fitScore = parsed <= 5 ? Math.min(100, Math.round(parsed * 20)) : Math.round(parsed);
        }
      }

      const fitLabel = get(labelIdx) || (fitScore !== null ? (fitScore >= 75 ? "High" : fitScore >= 50 ? "Medium" : "Low") : "");
      const rawStatus = get(statusIdx).toLowerCase();
      const status: UserStatus = rawStatus === "sent" ? "sent" : "pending";
      const rawDeliveryStatus = get(deliveryStatusIdx).toLowerCase();
      const deliveryStatus: DeliveryStatus = DELIVERY_STATUS_SET.has(rawDeliveryStatus)
        ? (rawDeliveryStatus as DeliveryStatus)
        : "";

      let firstName = get(firstIdx);
      if (!firstName) {
        const localPart = email.split("@")[0];
        if (/^[a-z]+\.[a-z]/i.test(localPart)) {
          firstName = localPart.split(".")[0];
          firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
      }

      return {
        email,
        status,
        sentAt:    get(sentAtIdx),
        firstName,
        lastName:  get(lastIdx),
        company:   get(companyIdx),
        website:   get(websiteIdx),
        phone:     get(phoneIdx),
        address:   get(addressIdx),
        title:     get(titleIdx),
        fitScore,
        fitLabel,
        linkedIn:  get(linkedInIdx),
        segment:   get(segmentIdx),
        priority:  get(priorityIdx) || (fitScore && fitScore >= 80 ? "High" : "Medium"),
        emailType: get(emailTypeIdx),
        resendId: get(resendIdIdx),
        resendStatus: get(resendStatusIdx),
        deliveryStatus,
        resendCreatedAt: get(resendCreatedAtIdx),
        resendScheduledAt: get(resendScheduledAtIdx),
        resendLastSyncedAt: get(resendLastSyncedAtIdx),
        resendSubject: get(resendSubjectIdx),
        resendFrom: get(resendFromIdx),
        resendTo: get(resendToIdx),
        resendError: get(resendErrorIdx),
      };
    })
    .filter((row): row is UserRow => row !== null);
}

export function serializeUsersCsv(users: UserRow[]): string {
  const header = OUTPUT_HEADERS.join(",");
  const body = users
    .map((u) =>
      [
        escapeCsvCell(u.email),
        escapeCsvCell(u.firstName),
        escapeCsvCell(u.lastName),
        escapeCsvCell(u.company),
        escapeCsvCell(u.website),
        escapeCsvCell(u.phone),
        escapeCsvCell(u.address),
        escapeCsvCell(u.title),
        u.fitScore !== null ? String(u.fitScore) : "",
        escapeCsvCell(u.fitLabel),
        u.status,
        u.sentAt ?? "",
        escapeCsvCell(u.linkedIn ?? ""),
        escapeCsvCell(u.segment ?? ""),
        escapeCsvCell(u.priority ?? ""),
        escapeCsvCell(u.emailType ?? ""),
        escapeCsvCell(u.resendId ?? ""),
        escapeCsvCell(u.resendStatus ?? ""),
        escapeCsvCell(u.deliveryStatus ?? ""),
        escapeCsvCell(u.resendCreatedAt ?? ""),
        escapeCsvCell(u.resendScheduledAt ?? ""),
        escapeCsvCell(u.resendLastSyncedAt ?? ""),
        escapeCsvCell(u.resendSubject ?? ""),
        escapeCsvCell(u.resendFrom ?? ""),
        escapeCsvCell(u.resendTo ?? ""),
        escapeCsvCell(u.resendError ?? ""),
      ].join(",")
    )
    .join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

export function getCsvStats(users: UserRow[]) {
  const total   = users.length;
  const invalid = users.filter((u) => !isValidEmail(u.email)).length;
  const sent    = users.filter((u) => u.status === "sent").length;
  const pending = users.filter((u) => u.status === "pending" && isValidEmail(u.email)).length;
  return { total, sent, pending, invalid };
}

export function getDailySentCount(users: UserRow[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return users.filter((u) => u.sentAt === today).length;
}
