const WARMUP_SCHEDULE = [
  { maxDays: 2, limit: 20 },
  { maxDays: 4, limit: 40 },
  { maxDays: 7, limit: 75 },
];
const MATURE_LIMIT = 100;

export function getWarmupDayNumber(): number {
  const startDateStr = process.env.WARMUP_START_DATE;
  if (!startDateStr) return 1;

  const start = new Date(startDateStr);
  const now = new Date();

  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, diffDays);
}

export function getDailyLimit(): number {
  const explicitCap = Number(process.env.DAILY_SEND_CAP);
  const cap = Number.isFinite(explicitCap) && explicitCap > 0 ? Math.floor(explicitCap) : MATURE_LIMIT;
  const day = getWarmupDayNumber();

  for (const step of WARMUP_SCHEDULE) {
    if (day <= step.maxDays) {
      return Math.min(step.limit, cap);
    }
  }

  return cap;
}
