import {
  readListUsersCsv,
  getMailingLists,
  getCsvStats,
  getDailySentCount,
} from "@/lib/csv";
import { getWarmupDayNumber, getDailyLimit } from "@/lib/warmup";
import { MailingListSelector } from "@/components/dashboard/mailing-list-selector";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CsvUploader } from "@/components/dashboard/csv-uploader";
import { SendBatchButton } from "@/components/dashboard/send-batch-button";
import { EmailTable } from "@/components/dashboard/email-table";
import { TestEmailForm } from "@/components/dashboard/test-email";
import { WarmupBanner } from "@/components/dashboard/warmup-banner";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Globe, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams?: Promise<{ listId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const activeListId = resolvedParams.listId || "default";

  const lists = await getMailingLists();
  const users = await readListUsersCsv(activeListId);
  const stats = getCsvStats(users);
  const sentToday = getDailySentCount(users);
  const warmupDay = getWarmupDayNumber();
  const dailyLimit = getDailyLimit();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-wppro-600 to-blue-500 text-white shadow-md shadow-wppro-600/20">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  WP Pro Outreach Engine
                </h1>
                <span className="flex items-center gap-1 rounded-full bg-wppro-100 px-2 py-0.5 text-[10px] font-bold text-wppro-700 dark:bg-wppro-950 dark:text-wppro-300">
                  <Sparkles className="h-3 w-3 text-wppro-500" /> AI Powered
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Selling AI Integration, Web Design, SEO & Ads |{" "}
                <a
                  href="https://wppro.au/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-wppro-600 hover:underline dark:text-wppro-400"
                >
                  wppro.au
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SendBatchButton
              pendingCount={stats.pending}
              dailyLimit={dailyLimit}
              sentToday={sentToday}
              activeListId={activeListId}
            />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Top Mailing List Selector */}
        <MailingListSelector lists={lists} activeListId={activeListId} />

        {/* Warmup Banner */}
        <WarmupBanner
          warmupDay={warmupDay}
          dailyLimit={dailyLimit}
          sentToday={sentToday}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatsCard label="Active List Leads" value={stats.total} sublabel="In selected list" />
          <StatsCard
            label="Pending Send"
            value={stats.pending}
            variant="info"
            sublabel="Ready for dispatch"
          />
          <StatsCard
            label="Sent Today"
            value={sentToday}
            sublabel={`Daily limit: ${dailyLimit}`}
          />
          <StatsCard label="Sent in List" value={stats.sent} variant="success" sublabel="This list" />
          <StatsCard
            label="Invalid Emails"
            value={stats.invalid}
            variant="warning"
            sublabel="Will be skipped"
          />
        </div>

        {/* Two-column upper row: CSV Uploader & Test Email */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CsvUploader activeListId={activeListId} />
          </div>
          <div>
            <TestEmailForm />
          </div>
        </div>

        {/* Recipient Lead Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recipient Lead Database ({users.length})
            </h2>
          </div>
          <EmailTable users={users} activeListId={activeListId} />
        </div>
      </main>
    </div>
  );
}
