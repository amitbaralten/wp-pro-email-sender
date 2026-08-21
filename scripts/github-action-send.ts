import path from "path";
import fs from "fs";
import { buildEmailSubject, buildEmailHtml } from "../lib/email-template";
import { getResendClient } from "../lib/resend";
import { getDailyLimit, getWarmupDayNumber } from "../lib/warmup";
import {
  getDailySentCount,
  isValidEmail,
  readListUsersCsv,
  withListLock,
  writeListUsersCsv,
} from "../lib/csv";

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
  console.log("Starting GitHub Actions daily email dispatcher...");

  const warmupDay = getWarmupDayNumber();
  const dailyMaxEmails = getDailyLimit();

  console.log(`Warmup schedule: day ${warmupDay}; daily cap ${dailyMaxEmails} emails.`);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY secret is missing in environment.");
  }

  if (process.env.GITHUB_ACTIONS === "true" && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required in GitHub Actions so send state persists outside git.");
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || "WP Pro <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";

  const listId = process.env.TARGET_LIST_ID || "google-maps-plumbers";

  await withListLock(listId, async () => {
    const users = await readListUsersCsv(listId);

    if (!users.length) {
      console.log(`List '${listId}' is empty or missing. Exiting.`);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const sentToday = getDailySentCount(users);
    console.log(`Sent today so far: ${sentToday}/${dailyMaxEmails}`);

    if (sentToday >= dailyMaxEmails) {
      console.log(`Daily quota of ${dailyMaxEmails} emails reached for ${today}. Exiting.`);
      return;
    }

    const remainingQuota = dailyMaxEmails - sentToday;
    const pendingUsers = users.filter((u) => u.status === "pending" && isValidEmail(u.email));
    console.log(`Found ${pendingUsers.length} valid pending leads. Dispatching up to ${remainingQuota}.`);

    if (!pendingUsers.length) {
      console.log("No valid pending leads to send.");
      return;
    }

    const toSend = pendingUsers.slice(0, remainingQuota);
    let successCount = 0;

    for (let i = 0; i < toSend.length; i++) {
      const user = toSend[i];
      console.log(`[${i + 1}/${toSend.length}] Dispatching email.`);

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
          console.error("Send failed:", res.error.message);
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
          console.log("Send accepted by Resend.");
        }
      } catch (err: unknown) {
        console.error("Exception sending email:", err instanceof Error ? err.message : err);
        user.resendError = err instanceof Error ? err.message : String(err);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`Dispatch complete. Successfully sent ${successCount} emails today.`);

    await writeListUsersCsv(listId, users);
    console.log("Updated list state saved.");
  });
}

runDailyActionSender().catch((err) => {
  console.error("Fatal error in GitHub Action sender:", err);
  process.exit(1);
});
