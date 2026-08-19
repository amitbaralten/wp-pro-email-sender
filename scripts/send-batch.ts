import { readUsersCsv, writeUsersCsv, isValidEmail, getDailySentCount } from "../lib/csv";
import { getResendClient } from "../lib/resend";
import { buildEmailSubject, buildEmailHtml } from "../lib/email-template";
import { getDailyLimit } from "../lib/warmup";

async function main() {
  console.log("🚀 Starting WP Pro Email Sender Batch Run...");

  const sender = process.env.RESEND_FROM_EMAIL || "WP Pro <hello@wppro.au>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";

  const users = await readUsersCsv();
  const dailyLimit = getDailyLimit();
  const alreadySentToday = getDailySentCount(users);
  const remainingSlots = dailyLimit - alreadySentToday;

  console.log(`📊 Warmup Daily Limit: ${dailyLimit}`);
  console.log(`✉️  Sent Today: ${alreadySentToday}`);
  console.log(`🔓 Remaining Slots Today: ${remainingSlots}`);

  if (remainingSlots <= 0) {
    console.log("🛑 Daily warmup limit reached. Exiting.");
    process.exit(0);
  }

  const pendingIndexes: number[] = [];
  for (let i = 0; i < users.length && pendingIndexes.length < remainingSlots; i++) {
    if (users[i].status === "pending" && isValidEmail(users[i].email)) {
      pendingIndexes.push(i);
    }
  }

  if (pendingIndexes.length === 0) {
    console.log("✅ No valid pending emails to send.");
    process.exit(0);
  }

  console.log(`📤 Preparing to send batch of ${pendingIndexes.length} emails via Resend...`);

  const resend = getResendClient();
  const response = await resend.batch.send(
    pendingIndexes.map((i) => ({
      from: sender,
      to: users[i].email,
      subject: buildEmailSubject(users[i]),
      html: buildEmailHtml(users[i]),
      replyTo,
    }))
  );

  if (response.error) {
    console.error("❌ Resend Batch Error:", response.error);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  pendingIndexes.forEach((i) => {
    users[i].status = "sent";
    users[i].sentAt = today;
    users[i].resendLastSyncedAt = now;
    users[i].deliveryStatus = "queued";
  });

  const batchData = response.data?.data ?? [];
  batchData.forEach((item, idx) => {
    const userIdx = pendingIndexes[idx];
    if (userIdx !== undefined) {
      users[userIdx].resendId = item.id;
      users[userIdx].resendStatus = "queued";
    }
  });

  await writeUsersCsv(users);
  console.log(`🎉 Batch send complete! Sent ${pendingIndexes.length} emails.`);
}

main().catch((err) => {
  console.error("Unhandled Batch Script Error:", err);
  process.exit(1);
});
