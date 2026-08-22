import { UserRow } from "@/lib/csv";
import {
  cleanCompanyName,
  extractSuburb,
  detectBusinessType,
  isGenericEmail,
} from "@/lib/email-utils";

export interface ServiceCopy {
  serviceName: string;
  painPoint: string;
  aiUseCases: string;
  valueHook: string;
  subjectHooks: string[];
}

/** Personalized copy slots an LLM can fill; any omitted field falls back to the deterministic template. */
export interface EmailCopyOverrides {
  subject?: string;
  opener?: string;
  painPoint?: string;
  aiUseCase?: string;
  valueHook?: string;
  cta?: string;
}

export function getWPProCopy(businessType: string): ServiceCopy {
  switch (businessType.toLowerCase()) {
    case "ndis & disability support":
      return {
        serviceName: "AI Participant Intake & NDIS Digital Growth Engine",
        painPoint: "NDIS participants and families searching for providers need immediate answers, but slow intake forms and phone tag create long delays.",
        aiUseCases: "Deploy a custom 24/7 AI Participant Intake & Support Assistant that pre-qualifies funding types (Self-Managed, Plan-Managed, NDIA), answers SIL/SDA housing questions, and schedules intake assessments automatically.",
        valueHook: "Combine accessible high-converting Web Design, top local NDIS search rankings, targeted Meta Ads, and AI intake workflows engineered to grow participant rosters.",
        subjectHooks: [
          "quick AI participant intake idea for your NDIS team",
          "automating participant intake for your NDIS services?",
          "scaling participant rosters with AI & web for your team?",
        ],
      };

    case "real estate":
      return {
        serviceName: "AI Business Integration & Digital Lead Growth",
        painPoint: "High-value real estate leads expect instant responses, but agents get bogged down with manual follow-ups and missed calls after hours.",
        aiUseCases: "Deploy a custom 24/7 AI Sales & Booking Assistant that instantly answers buyer/renter inquiries, qualifies budgets, and books viewings directly into your team's CRM.",
        valueHook: "Combine high-speed custom Web Design, hyper-local SEO, and AI automation to turn property inquiries into listings faster.",
        subjectHooks: [
          "quick AI idea for your listings",
          "automated lead response for your agency?",
          "scaling leads for your real estate team?",
        ],
      };

    case "legal":
      return {
        serviceName: "AI Intake Automation & High-Converting Web Stack",
        painPoint: "Potential clients shopping for legal counsel abandon slow websites, while senior staff waste hours manually triaging intake forms.",
        aiUseCases: "Implement an intelligent AI Client Intake Assistant that pre-qualifies cases, captures key facts, and schedules consultations automatically.",
        valueHook: "Modernize your firm with ultra-fast web design, authoritative local SEO, and AI intake workflows that double conversion rates.",
        subjectHooks: [
          "quick AI intake idea for your firm",
          "modern web & AI for your legal practice?",
          "automating client intake for your lawyers?",
        ],
      };

    case "finance":
    case "accounting & advisory":
      return {
        serviceName: "AI Automation & Premium Lead Engine",
        painPoint: "Brokers and advisors spend valuable time answering repetitive client queries instead of closing deals.",
        aiUseCases: "Integrate custom AI workflows to handle doc requests, appointment scheduling, and instant FAQs across email and web chat.",
        valueHook: "Position your brand with a sleek, high-performing website, top-ranking Google Ads, and automated AI client nurture sequences.",
        subjectHooks: [
          "quick AI workflow idea for your advisors",
          "digital growth & AI for your firm?",
          "automated client onboarding for your team?",
        ],
      };

    case "construction & trades":
      return {
        serviceName: "AI Quote Booking & Local SEO Growth",
        painPoint: "Trade supervisors and PMs miss valuable quote calls while on job sites, losing projects to faster competitors.",
        aiUseCases: "Set up an automated AI Quote & Booking Assistant that captures job specs, calculates rough quotes, and schedules site visits 24/7.",
        valueHook: "Dominate your local market with #1 Google SEO rankings, targeted Meta Ads, and AI systems that turn site visits into booked contracts.",
        subjectHooks: [
          "quick AI booking idea for your site team",
          "never miss a quote call for your business?",
          "local SEO & AI for your trade business?",
        ],
      };

    case "healthcare":
      return {
        serviceName: "AI Patient Triage & Digital Experience",
        painPoint: "Front-desk staff get overwhelmed with phone calls for simple appointment bookings and clinic FAQs.",
        aiUseCases: "Integrate an AI Patient Assistant that guides patients to the right practitioner, handles FAQ inquiries, and manages booking flows seamlessly.",
        valueHook: "Deliver a modern patient portal website, boosted local search visibility, and frictionless AI appointment booking.",
        subjectHooks: [
          "quick AI booking idea for your clinic",
          "modern web & AI for your practitioners?",
          "streamlining patient bookings with AI?",
        ],
      };

    case "hospitality":
    case "ecommerce & retail":
      return {
        serviceName: "AI Customer Concierge & E-Commerce Scaling",
        painPoint: "Customers bounce from slow online stores or uninspired websites without completing reservations or purchases.",
        aiUseCases: "Deploy a personalized AI Sales & Concierge Assistant that recommends products, answers product questions instantly, and recovers abandoned carts.",
        valueHook: "Scale your revenue with ultra-responsive Web Design, high-ROI Google & Meta Ads, and intelligent AI sales automation.",
        subjectHooks: [
          "quick AI sales idea for your brand",
          "scaling online revenue with AI & Web?",
          "modern web design & AI concierge for your store?",
        ],
      };

    default:
      return {
        serviceName: "AI Business Integration & Digital Growth Engine",
        painPoint: "Growing businesses lose up to 30% of potential leads due to slow website response times and manual operational bottlenecks.",
        aiUseCases: "Integrate custom AI Business Agents into your operational stack to automate lead triage, customer inquiries, and workflow follow-ups.",
        valueHook: "We combine ultra-fast Web Design, targeted SEO, Google/Meta Ads, and custom AI Business Integrations engineered specifically for your business growth.",
        subjectHooks: [
          "quick AI integration idea for your team",
          "scaling leads & AI for your business?",
          "modern web design + AI workflow for your team?",
        ],
      };
  }
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

export function buildEmailSubject(user: UserRow, override?: string): string {
  if (override?.trim()) return override.trim();

  const company = cleanCompanyName(user.company);
  const suburb = extractSuburb(user.address || "");
  const emailVal = typeof user.email === "string" ? user.email : "";

  if (company) {
    const variants = [
      `quick idea for ${company}`,
      `quick question for ${company}`,
      `helping ${company} get more work`,
    ];
    return variants[hashString(emailVal) % variants.length];
  }

  if (suburb) return `quick idea for a ${suburb} business`;
  return `quick idea for your business`;
}

export function buildEmailHtml(user: UserRow, overrides: EmailCopyOverrides = {}): string {
  const firstName = user.firstName?.trim() || "";
  const company = cleanCompanyName(user.company);
  const suburb = extractSuburb(user.address || "");
  const emailVal = typeof user.email === "string" ? user.email : "";
  const generic = isGenericEmail(emailVal);
  const isPersonal = !generic && (
    (user.emailType || "").toLowerCase().includes("personal") ||
    (user.emailType || "").toLowerCase().includes("named") ||
    !!firstName
  );
  const businessType = detectBusinessType(emailVal, user.company || "");

  // Never greet by company name; use first name if we have it, else a warm generic.
  const greeting = isPersonal && firstName ? firstName : "there";

  const where = suburb ? ` around ${suburb}` : "";
  let opener = company
    ? `I came across ${company} while looking at ${businessType} businesses${where}.`
    : `I've been looking at a few ${businessType} businesses${where}.`;
  if (overrides.opener?.trim()) opener = overrides.opener.trim();

  const painPoint =
    overrides.painPoint?.trim() ||
    `From a quick look, there are usually a couple of easy wins on the website and Google side that turn into more enquiries.`;

  const helpLine =
    overrides.valueHook?.trim() ||
    `We're WP Pro (wppro.au). We help ${businessType} businesses get more work with faster websites, stronger Google visibility, and simple automation.`;

  let websiteHost = "";
  try {
    if (user.website) websiteHost = new URL(user.website).hostname.replace(/^www\./, "");
  } catch {
    websiteHost = "";
  }
  const siteRef = websiteHost ? `your site (${websiteHost})` : "your current website";

  const ctaText =
    overrides.cta?.trim() ||
    `Want me to put together a free, no-obligation proposal with a quick analysis of ${siteRef}? Just reply "proposal" and I'll send it over, or reply "chat" if you'd rather hop on a quick call.`;

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 560px;">
  <p>Hi ${greeting},</p>
  <p>${opener} ${painPoint}</p>
  <p>${helpLine}</p>
  <p>${ctaText}</p>
  <p style="margin-top: 16px;">Cheers,<br>WP Pro Team</p>
  <p style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
    WP Pro · <a href="https://wppro.au/" style="color: #64748b; text-decoration: underline;">wppro.au</a>
  </p>
</div>
  `.trim();
}
