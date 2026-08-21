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

function pickSubjectHook(email: string, hooks: string[]): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return hooks[hash % hooks.length];
}

export function buildEmailSubject(user: UserRow): string {
  const firstName = user.firstName?.trim();
  const company = cleanCompanyName(user.company);
  const suburb = extractSuburb(user.address || "");
  const emailVal = typeof user.email === "string" ? user.email : "";
  const businessType = detectBusinessType(emailVal, user.company || "");
  const copy = getWPProCopy(businessType);

  const companyWithSuburb = company && suburb ? `${company} ${suburb}` : company;

  if (firstName && companyWithSuburb) {
    return `${firstName} - AI & digital growth idea for ${companyWithSuburb}?`;
  }
  if (firstName) {
    const hook = pickSubjectHook(emailVal, copy.subjectHooks);
    return `${firstName} - ${hook}`;
  }
  if (companyWithSuburb) {
    return `AI Integration & Web growth for ${companyWithSuburb}?`;
  }
  return `Quick AI Business Integration idea for ${company || "your team"}?`;
}

export function buildEmailHtml(user: UserRow): string {
  const firstName = user.firstName?.trim() || "";
  const lastName = user.lastName?.trim() || "";
  const title = user.title?.trim() || "";
  const company = cleanCompanyName(user.company);
  const suburb = extractSuburb(user.address || "");
  const emailVal = typeof user.email === "string" ? user.email : "";
  const generic = isGenericEmail(emailVal);
  const isPersonal = !generic && (
    (user.emailType || "").toLowerCase().includes("personal") ||
    (user.emailType || "").toLowerCase().includes("named") ||
    !!firstName
  );
  const hasLinkedIn = !!(user.linkedIn?.trim());
  const isHighPri = (user.priority || "").toLowerCase() === "high";

  const businessType = detectBusinessType(emailVal, user.company || "");
  const copy = getWPProCopy(businessType);

  const greeting = isPersonal && firstName ? firstName : company || "there";

  const linkedInLine = hasLinkedIn && firstName
    ? `<p>I was reviewing your work at ${company || "your team"} and wanted to reach out directly.</p>`
    : "";

  let opener: string;
  if (title && company && isPersonal) {
    opener = `As ${title} at ${company}, you know how vital it is to convert every digital inquiry into a high-value client.`;
  } else if (company && isPersonal) {
    opener = `Leading operations at ${company}, you know how crucial it is to convert every inbound inquiry into a high-value customer.`;
  } else if (company) {
    opener = `At ${company}, driving consistent growth and streamlining operations is key to outperforming competitors.`;
  } else {
    opener = `Driving business growth while keeping team productivity high is a major focus for team leaders right now.`;
  }

  const locationLine = suburb
    ? `At <strong>WP Pro</strong> (<a href="https://wppro.au/" style="color:#026fc7;text-decoration:none;">wppro.au</a>), we partner with ${businessType} teams in Sydney and across Australia, including businesses near ${suburb}.`
    : `At <strong>WP Pro</strong> (<a href="https://wppro.au/" style="color:#026fc7;text-decoration:none;">wppro.au</a>), we partner with ${businessType} teams across Australia.`;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const teamRef = company ? `you and the ${company} team` : fullName || "you and your business";

  const cta = isHighPri
    ? `Would you be open to a quick 10-minute strategy chat this week to see how an AI Business Integration could work for ${teamRef}? Reply to this email and I'll send over a few convenient times.`
    : `Would you be open to a quick look at a custom AI & web audit breakdown for ${teamRef}? Simply reply and I'll send over a 2-minute video overview tailored to your setup.`;

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 600px;">
  <p>Hi ${greeting},</p>
  ${linkedInLine}
  <p>${opener} ${copy.painPoint}</p>
  <p>${locationLine}</p>
  <p>We specialize in four key growth pillars for modern businesses:</p>
  <ul style="padding-left: 20px; margin: 12px 0;">
    <li style="margin-bottom: 6px;"><strong>AI Business Integration:</strong> ${copy.aiUseCases}</li>
    <li style="margin-bottom: 6px;"><strong>High-Converting Web Site Design:</strong> Blazing-fast, ultra-modern WordPress & custom web applications designed to turn visitors into leads.</li>
    <li style="margin-bottom: 6px;"><strong>Search Engine Optimization (SEO):</strong> Dominating local and national search results to capture high-intent organic traffic.</li>
    <li style="margin-bottom: 6px;"><strong>Google & Meta Paid Ads:</strong> Scalable, data-driven paid advertising campaigns built for maximum ROI.</li>
  </ul>
  <p>${copy.valueHook}</p>
  <p>${cta}</p>
  <br>
  <p style="margin-bottom: 4px;">Best regards,</p>
  <p style="margin-top: 0; font-weight: bold; color: #0f172a;">WP Pro Team</p>
  <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
    <strong>WP Pro</strong> | Digital Growth & AI Integration Specialists<br>
    Website: <a href="https://wppro.au/" style="color: #026fc7; text-decoration: underline;">https://wppro.au/</a><br>
    Email: <a href="mailto:hello@wppro.au" style="color: #026fc7; text-decoration: underline;">hello@wppro.au</a>
  </p>
</div>
  `.trim();
}
