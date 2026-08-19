import { ShieldCheck, Flame } from "lucide-react";

interface WarmupBannerProps {
  warmupDay: number;
  dailyLimit: number;
  sentToday: number;
}

export function WarmupBanner({ warmupDay, dailyLimit, sentToday }: WarmupBannerProps) {
  const percentage = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  return (
    <div className="rounded-xl border border-wppro-200 bg-gradient-to-r from-wppro-50/80 to-blue-50/50 p-4 dark:border-wppro-900/50 dark:from-wppro-950/40 dark:to-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wppro-600 text-white shadow-md shadow-wppro-600/20">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Domain Warmup Schedule: Day {warmupDay}
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-wppro-100 px-2 py-0.5 text-[11px] font-semibold text-wppro-700 dark:bg-wppro-900/60 dark:text-wppro-300">
                <ShieldCheck className="h-3 w-3" /> Protected
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Warmup safeguards deliverability for hello@wppro.au. Today&apos;s daily cap is{" "}
              <strong className="text-slate-900 dark:text-white">{dailyLimit} emails</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-32 sm:w-40">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              <span>{sentToday} sent</span>
              <span>{dailyLimit} limit</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-wppro-600 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
