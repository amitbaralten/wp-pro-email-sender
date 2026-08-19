"use server";

import { revalidatePath } from "next/cache";
import {
  readListUsersCsv,
  writeListUsersCsv,
  parseUsersCsv,
  isValidEmail,
  getDailySentCount,
  getMailingLists,
  createMailingList,
  deleteMailingList,
  UserRow,
  MailingListMeta,
} from "@/lib/csv";
import { getResendClient } from "@/lib/resend";
import { buildEmailSubject, buildEmailHtml } from "@/lib/email-template";
import { getDailyLimit } from "@/lib/warmup";
import { syncResendStatuses } from "@/lib/resend-sync";

export type UploadState = {
  error: string | null;
  count?: number;
  preserved?: number;
  newListId?: string;
} | null;

export async function uploadCsvAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const file = formData.get("csv") as File | null;
  const listId = (formData.get("listId") as string | null) || "default";
  const newListName = (formData.get("newListName") as string | null)?.trim();

  if (!file || file.size === 0) {
    return { error: "Please select a valid CSV file." };
  }

  try {
    const text = await file.text();
    const incoming = parseUsersCsv(text);
    if (!incoming.length) {
      return { error: "CSV file is empty or missing email addresses." };
    }

    let targetListId = listId;

    // If user asked to create a new list during upload
    if (newListName) {
      const created = await createMailingList(newListName);
      targetListId = created.id;
    }

    const existingUsers = await readListUsersCsv(targetListId);
    const sentMap = new Map<string, UserRow>();
    existingUsers.forEach((u) => {
      if (u.status === "sent") {
        sentMap.set(u.email.toLowerCase(), u);
      }
    });

    let preserved = 0;
    const merged = incoming.map((user) => {
      const existing = sentMap.get(user.email.toLowerCase());
      if (existing) {
        preserved++;
        return {
          ...user,
          status: existing.status,
          sentAt: existing.sentAt,
          resendId: existing.resendId,
          resendStatus: existing.resendStatus,
          deliveryStatus: existing.deliveryStatus,
        };
      }
      return user;
    });

    await writeListUsersCsv(targetListId, merged);
    revalidatePath("/");

    return {
      error: null,
      count: merged.length,
      preserved,
      newListId: targetListId,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to parse CSV file." };
  }
}

export async function createMailingListAction(
  name: string
): Promise<{ error: string | null; list?: MailingListMeta }> {
  if (!name.trim()) return { error: "List name cannot be empty." };
  try {
    const list = await createMailingList(name.trim());
    revalidatePath("/");
    return { error: null, list };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to create mailing list." };
  }
}

export async function deleteMailingListAction(
  listId: string
): Promise<{ error: string | null }> {
  try {
    await deleteMailingList(listId);
    revalidatePath("/");
    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to delete mailing list." };
  }
}

export async function sendBatchAction(
  listId = "default"
): Promise<{
  error: string | null;
  sent: number;
  skipped: number;
  dailyLimit: number;
  alreadySentToday: number;
}> {
  const sender = process.env.RESEND_FROM_EMAIL || "WP Pro <hello@wppro.au>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";
  const customSubject = process.env.RESEND_SUBJECT;
  const customHtml = process.env.RESEND_HTML;

  try {
    const users = await readListUsersCsv(listId);
    const pendingIndexes: number[] = [];

    const dailyLimit = getDailyLimit();
    const alreadySentToday = getDailySentCount(users);
    const remainingSlots = dailyLimit - alreadySentToday;

    if (remainingSlots <= 0) {
      return {
        error: `Daily warmup limit of ${dailyLimit} emails reached for today. Try again tomorrow.`,
        sent: 0,
        skipped: 0,
        dailyLimit,
        alreadySentToday,
      };
    }

    for (let i = 0; i < users.length && pendingIndexes.length < remainingSlots; i++) {
      if (users[i].status === "pending" && isValidEmail(users[i].email)) {
        pendingIndexes.push(i);
      }
    }

    const skippedInvalid = users.filter(
      (u) => u.status === "pending" && !isValidEmail(u.email)
    ).length;

    if (pendingIndexes.length === 0) {
      return {
        error: null,
        sent: 0,
        skipped: skippedInvalid,
        dailyLimit,
        alreadySentToday,
      };
    }

    const resend = getResendClient();
    const response = await resend.batch.send(
      pendingIndexes.map((i) => ({
        from: sender,
        to: users[i].email,
        subject: customSubject || buildEmailSubject(users[i]),
        html: customHtml || buildEmailHtml(users[i]),
        replyTo,
      }))
    );

    if (response.error) {
      return {
        error: `Resend error: ${JSON.stringify(response.error)}`,
        sent: 0,
        skipped: skippedInvalid,
        dailyLimit,
        alreadySentToday,
      };
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

    await writeListUsersCsv(listId, users);
    revalidatePath("/");

    return {
      error: null,
      sent: pendingIndexes.length,
      skipped: skippedInvalid,
      dailyLimit,
      alreadySentToday: alreadySentToday + pendingIndexes.length,
    };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Batch send failed.",
      sent: 0,
      skipped: 0,
      dailyLimit: getDailyLimit(),
      alreadySentToday: 0,
    };
  }
}

export async function sendSingleEmailAction(
  rowIndex: number,
  emailCheck: string,
  force = false,
  listId = "default"
): Promise<{ error: string | null }> {
  const sender = process.env.RESEND_FROM_EMAIL || "WP Pro <hello@wppro.au>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";

  try {
    const users = await readListUsersCsv(listId);
    const target =
      users[rowIndex]?.email === emailCheck
        ? rowIndex
        : users.findIndex((u) => u.email === emailCheck);

    if (target === -1) return { error: "Recipient not found." };

    const user = users[target];
    if (!isValidEmail(user.email)) return { error: "Invalid email address." };
    if (user.status === "sent" && !force) return { error: null };

    const resend = getResendClient();
    const subject = process.env.RESEND_SUBJECT || buildEmailSubject(user);
    const html = process.env.RESEND_HTML || buildEmailHtml(user);

    const response = await resend.emails.send({
      from: sender,
      to: user.email,
      subject,
      html,
      replyTo,
    });

    if (response.error) {
      return { error: `Resend error: ${JSON.stringify(response.error)}` };
    }

    users[target].status = "sent";
    users[target].sentAt = new Date().toISOString().slice(0, 10);
    users[target].resendId = response.data?.id ?? "";
    users[target].resendStatus = "queued";
    users[target].deliveryStatus = "queued";
    users[target].resendLastSyncedAt = new Date().toISOString();

    await writeListUsersCsv(listId, users);
    revalidatePath("/");
    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Send failed." };
  }
}

export async function syncResendStatusesAction(
  listId = "default"
): Promise<{
  error: string | null;
  checked: number;
  updated: number;
  finalized: number;
}> {
  const result = await syncResendStatuses();
  if (!result.error) {
    revalidatePath("/");
  }
  return result;
}

export async function deleteUsersAction(
  emails: string[],
  listId = "default"
): Promise<{ error: string | null; deleted: number }> {
  if (!emails.length) return { error: null, deleted: 0 };
  const emailSet = new Set(emails.map((e) => e.toLowerCase()));
  try {
    const users = await readListUsersCsv(listId);
    const before = users.length;
    const remaining = users.filter((u) => !emailSet.has(u.email.toLowerCase()));
    await writeListUsersCsv(listId, remaining);
    revalidatePath("/");
    return { error: null, deleted: before - remaining.length };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Delete failed.", deleted: 0 };
  }
}

export type TestEmailState = { error: string | null; ok?: boolean } | null;

export async function sendTestEmailAction(
  _prev: TestEmailState,
  formData: FormData
): Promise<TestEmailState> {
  const to = (formData.get("to") as string | null)?.trim();
  const sender = process.env.RESEND_FROM_EMAIL || "WP Pro <hello@wppro.au>";
  const replyTo = process.env.RESEND_REPLY_TO || "info@wppro.au";

  if (!to || !isValidEmail(to)) {
    return { error: "Please enter a valid email address." };
  }

  try {
    const resend = getResendClient();
    const previewRow: UserRow = {
      email: to,
      status: "pending",
      sentAt: "",
      company: "Acme Business Solutions",
      website: "https://example.com",
      phone: "0400 000 000",
      address: "Parramatta NSW 2150",
      firstName: "Sarah",
      lastName: "Jenkins",
      title: "Managing Director",
      fitScore: 92,
      fitLabel: "High",
      linkedIn: "https://linkedin.com/in/sample",
      segment: "Sydney Business Leads",
      priority: "High",
      emailType: "Personalized",
      resendId: "",
      resendStatus: "",
      deliveryStatus: "",
      resendCreatedAt: "",
      resendScheduledAt: "",
      resendLastSyncedAt: "",
      resendSubject: "",
      resendFrom: "",
      resendTo: "",
      resendError: "",
    };

    const response = await resend.emails.send({
      from: sender,
      to,
      subject: `[TEST] ${buildEmailSubject(previewRow)}`,
      html: buildEmailHtml(previewRow),
      replyTo,
    });

    if (response.error) {
      return { error: `Resend error: ${JSON.stringify(response.error)}` };
    }
    return { error: null, ok: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to send test email." };
  }
}
