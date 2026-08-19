"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Send, CheckCircle, AlertCircle } from "lucide-react";
import { sendBatchAction, syncResendStatusesAction } from "@/app/actions";

interface SendBatchButtonProps {
  pendingCount: number;
  dailyLimit: number;
  sentToday: number;
  activeListId?: string;
}

export function SendBatchButton({ pendingCount, dailyLimit, sentToday, activeListId = "default" }: SendBatchButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [result, setResult] = useState<{
    error: string | null;
    sent: number;
    skipped: number;
    dailyLimit: number;
    alreadySentToday: number;
  } | null>(null);

  const [syncResult, setSyncResult] = useState<{
    error: string | null;
    checked: number;
    updated: number;
    finalized: number;
  } | null>(null);

  const remaining = Math.max(0, dailyLimit - sentToday);
  const willSend = Math.min(pendingCount, remaining);
  const limitReached = remaining <= 0;

  function handleSendBatch() {
    setResult(null);
    startTransition(async () => {
      const res = await sendBatchAction(activeListId);
      setResult(res);
    });
  }

  function handleSyncStatuses() {
    setSyncResult(null);
    startSyncTransition(async () => {
      const res = await syncResendStatusesAction(activeListId);
      setSyncResult(res);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleSyncStatuses}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing Resend..." : "Sync Delivery Statuses"}
        </button>

        <button
          onClick={handleSendBatch}
          disabled={isPending || pendingCount === 0 || limitReached}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-wppro-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-wppro-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {isPending
            ? "Sending Batch..."
            : limitReached
            ? "Daily Limit Reached"
            : `Send ${willSend} Email${willSend !== 1 ? "s" : ""} (${remaining} slots left)`}
        </button>
      </div>

      {result?.error && (
        <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {result.error}
        </p>
      )}

      {!result?.error && result !== null && (
        <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" />
          {result.sent > 0
            ? `Sent ${result.sent} email${result.sent !== 1 ? "s" : ""}.${
                result.skipped > 0 ? ` Skipped ${result.skipped} invalid.` : ""
              } (${result.alreadySentToday}/${result.dailyLimit} sent today)`
            : "No valid pending emails to send."}
        </p>
      )}

      {syncResult?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{syncResult.error}</p>
      )}

      {!syncResult?.error && syncResult !== null && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Synced {syncResult.checked} email{syncResult.checked !== 1 ? "s" : ""}. Updated{" "}
          {syncResult.updated}, finalized {syncResult.finalized}.
        </p>
      )}
    </div>
  );
}
