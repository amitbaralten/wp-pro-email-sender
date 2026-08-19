import { getResendClient } from "@/lib/resend";
import { readUsersCsv, writeUsersCsv, UserRow, DeliveryStatus } from "@/lib/csv";

/** Terminal status set that no longer needs active polling */
const FINAL_STATUSES: Set<DeliveryStatus> = new Set([
  "delivered",
  "bounced",
  "failed",
  "complained",
  "suppressed",
  "canceled",
]);

export async function syncResendStatuses(): Promise<{
  error: string | null;
  checked: number;
  updated: number;
  finalized: number;
}> {
  try {
    const resend = getResendClient();
    const users = await readUsersCsv();

    let checked = 0;
    let updated = 0;
    let finalized = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      // Only check emails that have a resend ID and haven't reached terminal delivery status
      if (!user.resendId || FINAL_STATUSES.has(user.deliveryStatus)) {
        continue;
      }

      checked++;

      try {
        const response = await resend.emails.get(user.resendId);
        if (response.error || !response.data) {
          user.resendError = response.error ? JSON.stringify(response.error) : "No data returned";
          continue;
        }

        const data = response.data;
        const newDeliveryStatus = (data.last_event as DeliveryStatus) || "";
        const now = new Date().toISOString();

        if (
          user.deliveryStatus !== newDeliveryStatus ||
          user.resendStatus !== data.last_event
        ) {
          updated++;
          user.deliveryStatus = newDeliveryStatus;
          user.resendStatus = data.last_event || user.resendStatus;
          user.resendCreatedAt = data.created_at || user.resendCreatedAt;
          user.resendScheduledAt = data.scheduled_at || user.resendScheduledAt;
          user.resendSubject = data.subject || user.resendSubject;
          user.resendFrom = data.from || user.resendFrom;
          user.resendTo = Array.isArray(data.to) ? data.to.join(", ") : data.to || user.resendTo;
          user.resendLastSyncedAt = now;

          if (FINAL_STATUSES.has(newDeliveryStatus)) {
            finalized++;
          }
        }
      } catch (e: unknown) {
        user.resendError = e instanceof Error ? e.message : "Fetch status error";
      }
    }

    if (updated > 0) {
      await writeUsersCsv(users);
    }

    return { error: null, checked, updated, finalized };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Sync failed.",
      checked: 0,
      updated: 0,
      finalized: 0,
    };
  }
}
