"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Mail, Eye, Building2, MapPin, Briefcase, Sparkles, RefreshCw } from "lucide-react";
import { UserRow } from "@/lib/csv";
import { buildEmailSubject, buildEmailHtml } from "@/lib/email-template";
import { detectBusinessType } from "@/lib/email-utils";
import { previewEmailAction } from "@/app/actions";

interface EmailPreviewModalProps {
  user: UserRow | null;
  onClose: () => void;
}

export function EmailPreviewModal({ user, onClose }: EmailPreviewModalProps) {
  const [ai, setAi] = useState<{ key: string; subject: string; html: string } | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const currentKey = user ? `${user.email}::${nonce}` : "";

  // Deterministic version, derived during render so it shows instantly.
  const template = useMemo(
    () =>
      user
        ? { subject: buildEmailSubject(user), html: buildEmailHtml(user) }
        : { subject: "", html: "" },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    const key = `${user.email}::${nonce}`;

    let cancelled = false;
    previewEmailAction(user)
      .then((res) => {
        if (!cancelled && res.ai) setAi({ key, subject: res.subject, html: res.html });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSettledKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  if (!user) return null;

  const hasAi = ai?.key === currentKey;
  const loading = settledKey !== currentKey;
  const subject = hasAi ? ai!.subject : template.subject;
  const htmlContent = hasAi ? ai!.html : template.html;
  const isAi = hasAi;
  const businessType = detectBusinessType(user.email, user.company || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wppro-100 text-wppro-600 dark:bg-wppro-950 dark:text-wppro-400">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Email Preview</h3>
              <p className="text-xs text-slate-500">Live personalization generator for WP Pro</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 dark:border-slate-800/50 dark:bg-slate-950/40 text-xs">
          <span className="flex items-center gap-1 text-slate-700 font-medium dark:text-slate-300">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            {user.email}
          </span>
          {user.company && (
            <span className="flex items-center gap-1 rounded bg-slate-200/70 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Building2 className="h-3 w-3 text-slate-400" />
              {user.company}
            </span>
          )}
          {user.address && (
            <span className="flex items-center gap-1 rounded bg-slate-200/70 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <MapPin className="h-3 w-3 text-slate-400" />
              {user.address}
            </span>
          )}
          <span className="flex items-center gap-1 rounded bg-wppro-100 px-2 py-0.5 font-semibold text-wppro-700 dark:bg-wppro-950 dark:text-wppro-300 uppercase">
            <Briefcase className="h-3 w-3 text-wppro-500" />
            {businessType}
          </span>
        </div>

        <div className="border-b border-slate-100 px-6 py-3 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject:</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Personalizing with ox-alpha…
                </span>
              ) : isAi ? (
                <span className="flex items-center gap-1 rounded bg-wppro-100 px-2 py-0.5 text-xs font-semibold text-wppro-700 dark:bg-wppro-950 dark:text-wppro-300">
                  <Sparkles className="h-3 w-3" />
                  AI personalized
                </span>
              ) : (
                <span className="text-xs text-slate-400">Template</span>
              )}
              <button
                onClick={() => setNonce((n) => n + 1)}
                disabled={loading}
                title="Regenerate"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{subject}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-slate max-w-none text-sm dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
