interface StatsCardProps {
  label: string;
  value: number;
  sublabel?: string;
  variant?: "default" | "warning" | "success" | "info";
}

export function StatsCard({ label, value, sublabel, variant = "default" }: StatsCardProps) {
  const textColor =
    variant === "warning" && value > 0
      ? "text-amber-600 dark:text-amber-400"
      : variant === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "info"
      ? "text-wppro-600 dark:text-wppro-400"
      : "text-slate-900 dark:text-white";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${textColor}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>}
    </div>
  );
}
