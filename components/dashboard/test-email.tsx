"use client";

import { useState, useTransition } from "react";
import { Send, MailCheck, AlertCircle } from "lucide-react";
import { sendTestEmailAction, TestEmailState } from "@/app/actions";

export function TestEmailForm() {
  const [state, setState] = useState<TestEmailState>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await sendTestEmailAction(null, formData);
      setState(res);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-2 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Send className="h-4 w-4 text-wppro-600" />
        Send Test Personalized Email
      </h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Dispatch a sample WP Pro cold outreach email (with AI Integration & Web design copy) to your inbox.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
        <input
          type="email"
          name="to"
          required
          placeholder="your-email@wppro.au"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-wppro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-wppro-600 dark:hover:bg-wppro-500"
        >
          {isPending ? "Sending..." : "Send Test Email"}
        </button>
      </form>

      {state?.error && (
        <p className="mt-3 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {state.error}
        </p>
      )}

      {state?.ok && (
        <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <MailCheck className="h-3.5 w-3.5" />
          Test email successfully sent! Check your inbox.
        </p>
      )}
    </div>
  );
}
