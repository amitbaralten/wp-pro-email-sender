/**
 * Domain Warmup Limits Schedule:
 * Day 1-2:   20 emails/day
 * Day 3-4:   40 emails/day
 * Day 5-7:   75 emails/day
 * Day 8-10:  125 emails/day
 * Day 11-14: 200 emails/day
 * Day 15+:   350 emails/day
 */
const WARMUP_SCHEDULE = [
  { maxDays: 2, limit: 20 },
  { maxDays: 4, limit: 40 },
  { maxDays: 7, limit: 75 },
  { maxDays: 10, limit: 125 },
  { maxDays: 14, limit: 200 },
];
const MATURE_LIMIT = 350;

export function getWarmupDayNumber(): number {
  const startDateStr = process.env.WARMUP_START_DATE;
  if (!startDateStr) return 1;

  const start = new Date(startDateStr);
  const now = new Date();

  // Reset time portions for pure day difference calculation
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, diffDays);
}

export function getDailyLimit(): number {
  const day = getWarmupDayNumber();

  for (const step of WARMUP_SCHEDULE) {
    if (day <= step.maxDays) {
      return step.limit;
    }
  }

  return MATURE_LIMIT;
}
