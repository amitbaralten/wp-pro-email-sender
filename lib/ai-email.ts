import { UserRow } from "@/lib/csv";
import {
  buildEmailSubject,
  buildEmailHtml,
  EmailCopyOverrides,
} from "@/lib/email-template";
import { cleanCompanyName, extractSuburb, detectBusinessType } from "@/lib/email-utils";
import { isOpenRouterConfigured, prompt } from "@/lib/openrouter";

/** AI email copy is on by default when OpenRouter is configured; set AI_EMAILS=0 to force templates. */
export function aiEmailsEnabled(): boolean {
  if (!isOpenRouterConfigured()) return false;
  const flag = (process.env.AI_EMAILS || "").toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function coerceCopy(raw: unknown): EmailCopyOverrides | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Strip em/en dashes (an AI tell) and tidy resulting punctuation.
  const pick = (v: unknown) => {
    if (typeof v !== "string" || !v.trim()) return undefined;
    return v
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/\s*,\s*,/g, ",")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const copy: EmailCopyOverrides = {
    subject: pick(r.subject),
    opener: pick(r.opener),
    painPoint: pick(r.painPoint),
    aiUseCase: pick(r.aiUseCase),
    valueHook: pick(r.valueHook),
    cta: pick(r.cta),
  };

  // Require at least a subject or opener to consider the response usable.
  return copy.subject || copy.opener ? copy : null;
}

const SYSTEM_PROMPT = `You write short, personal cold emails for WP Pro, a small Australian web + AI studio (wppro.au). The email must read like a real person typed it quickly to one business owner, NOT like a marketing email.

Return ONLY a JSON object (no markdown, no commentary) with these string fields:
- subject: 3-6 words, lowercase and casual, specific to their business, no Title Case, no emojis, no salesy words. It should read like an internal note.
- opener: one short first line that sounds like you actually looked at their business/area. No "As Managing Director...", no flattery.
- painPoint: one plain, concrete sentence about a real problem this kind of business faces.
- valueHook: one plain sentence on how WP Pro helps (faster website, Google/SEO, simple automation). No feature lists.
- cta: one casual sentence giving two options: reply for a free, no-obligation proposal that includes a quick analysis of their website, OR reply to book a quick chat.

Rules:
- Keep the total across all fields under ~90 words. Tight and skimmable.
- Use contractions. Write like a human, not a brand.
- BANNED words/phrases: revolutionary, cutting-edge, leverage, solutions, elevate, unlock, dominate, seamless, supercharge, game-changer, "in today's fast-paced", "we specialize", "high-value", and exclamation-mark hype.
- Do NOT use em dashes or en dashes (the "—" or "–" characters). Use commas or full stops instead. Regular hyphens in words are fine.
- Do NOT invent specific facts about their website you can't know.
- No bullet points, no headings, no emojis.

Example of the right tone (plumber):
{"subject":"quick idea for parramatta plumbing","opener":"I came across your plumbing business while looking around Parramatta.","painPoint":"A lot of local plumbers lose jobs when after-hours calls go to voicemail and people just ring the next name on Google.","valueHook":"We build fast websites and set up simple booking and auto-reply tools that catch those jobs.","cta":"Want a free proposal with a quick look at your site? Reply 'proposal' and I'll send it, or reply 'chat' for a quick call."}`;

/** Ask ox-alpha for personalized copy slots; returns null on any failure. */
export async function generateEmailCopy(user: UserRow): Promise<EmailCopyOverrides | null> {
  const company = cleanCompanyName(user.company) || "(unknown)";
  const suburb = extractSuburb(user.address || "") || "(unknown)";
  const businessType = detectBusinessType(user.email, user.company || "");

  const userPrompt = `Business: ${company}
Contact: ${[user.firstName, user.lastName].filter(Boolean).join(" ") || "(no name)"}
Suburb: ${suburb}
Website: ${user.website || "(none)"}
Type of business: ${businessType}

Write the JSON copy now.`;

  try {
    // ox-alpha is a reasoning model: max_tokens covers reasoning + answer, so keep headroom.
    const raw = await prompt(SYSTEM_PROMPT, userPrompt, { maxTokens: 1200, temperature: 0.7 });
    const parsed = JSON.parse(stripJsonFences(raw));
    return coerceCopy(parsed);
  } catch {
    return null;
  }
}

/**
 * Builds a personalized email, using ox-alpha copy when enabled and available,
 * and always falling back to the deterministic template.
 */
export async function buildAiEmail(user: UserRow): Promise<{ subject: string; html: string; ai: boolean }> {
  if (!aiEmailsEnabled()) {
    return { subject: buildEmailSubject(user), html: buildEmailHtml(user), ai: false };
  }

  const copy = await generateEmailCopy(user);
  if (!copy) {
    return { subject: buildEmailSubject(user), html: buildEmailHtml(user), ai: false };
  }

  return {
    subject: buildEmailSubject(user, copy.subject),
    html: buildEmailHtml(user, copy),
    ai: true,
  };
}
