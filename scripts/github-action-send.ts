import fs from "fs";
import path from "path";
import { parseUsersCsv, serializeUsersCsv, UserRow } from "../lib/csv-parser";
import { buildEmailSubject, buildEmailHtml } from "../lib/email-template";
import { getResendClient } from "../lib/resend";
import { getDailyLimit, getWarmupDayNumber } from "../lib/warmup";

// Load .env.local if running locally
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value.trim();
    }
  }
}

async function runDailyActionSender() {
  console.log("🚀 Starting GitHub Actions Daily Email Dispatcher...");

  const warmupDay = getWarmupDayNumber();
  const warmupLimit = getDailyLimit();
  const DAILY_MAX_EMAILS = Math.min(100, warmupLimit);

  console.log(`📈 Warmup Schedule: Day ${warmupDay} | Calculated Daily Cap: ${DAILY_MAX_EMAILS} emails/day`);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("❌ RESEND_API_KEY secret is missing in environment.");
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || "WP Pro <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";

  const listId = process.env.TARGET_LIST_ID || "google-maps-plumbers";
  const listPath = path.join(__dirname, "..", "public", "lists", `${listId}.csv`);

  if (!fs.existsSync(listPath)) {
    console.log(`⚠️ List file not found at '${listPath}'. Exiting.`);
    return;
  }

  const rawText = fs.readFileSync(listPath, "utf-8");
  const users = parseUsersCsv(rawText);
  const today = new Date().toISOString().slice(0, 10);

  const sentToday = users.filter((u) => u.sentAt === today).length;
  console.log(`📊 Sent today so far: ${sentToday}/${DAILY_MAX_EMAILS}`);

  if (sentToday >= DAILY_MAX_EMAILS) {
    console.log(`🛑 Daily quota of ${DAILY_MAX_EMAILS} emails reached for today (${today}). Exiting.`);
    return;
  }

  const remainingQuota = DAILY_MAX_EMAILS - sentToday;
  const pendingUsers = users.filter((u) => u.status !== "sent");
  console.log(`📌 Found ${pendingUsers.length} pending leads. Preparing to dispatch up to ${remainingQuota} emails...`);

  if (!pendingUsers.length) {
    console.log("🎉 All leads in this list have already been sent!");
    return;
  }

  const toSend = pendingUsers.slice(0, remainingQuota);
  let successCount = 0;

  for (let i = 0; i < toSend.length; i++) {
    const user = toSend[i];
    console.log(`\n[${i + 1}/${toSend.length}] Dispatching email to: ${user.company} (${user.email})...`);

    const subject = buildEmailSubject(user);
    const html = buildEmailHtml(user);

    try {
      const res = await resend.emails.send({
        from,
        to: user.email,
        replyTo,
        subject,
        html,
      });

      if (res.error) {
        console.error(`  ❌ Failed to send to ${user.email}:`, res.error.message);
        user.resendError = res.error.message;
      } else {
        user.status = "sent";
        user.sentAt = today;
        user.resendId = res.data?.id || "";
        user.resendStatus = "sent";
        user.deliveryStatus = "sent";
        user.resendSubject = subject;
        user.resendFrom = from;
        user.resendTo = user.email;

        successCount++;
        console.log(`  ✓ Successfully sent! Resend ID: ${user.resendId}`);
      }
    } catch (err: unknown) {
      console.error(`  ❌ Exception sending to ${user.email}:`, err instanceof Error ? err.message : err);
      user.resendError = err instanceof Error ? err.message : String(err);
    }

    // 1-second delay between sends to respect rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n🎉 Dispatch complete! Successfully sent ${successCount} emails today.`);

  const updatedCsv = serializeUsersCsv(users);
  fs.writeFileSync(listPath, updatedCsv, "utf-8");
  console.log(`📁 Updated CSV state saved to: ${listPath}`);
}

runDailyActionSender().catch((err) => {
  console.error("Fatal error in GitHub Action sender:", err);
  process.exit(1);
});
