// src/modules/sales/timezone.ts

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Returns a UTC Date representing 00:00:00 (midnight) in East Africa Time (EAT, UTC+3)
 * for the given timestamp. EAT does not observe daylight saving time.
 */
export function getEatStartOfDayUtc(now = new Date()): Date {
  const eatTime = new Date(now.getTime() + EAT_OFFSET_MS);
  const startOfDayEatUtcMs =
    Date.UTC(eatTime.getUTCFullYear(), eatTime.getUTCMonth(), eatTime.getUTCDate()) -
    EAT_OFFSET_MS;

  return new Date(startOfDayEatUtcMs);
}

/**
 * Validates whether a transaction was completed within the allowable void window.
 * Default window is 15 minutes.
 */
export function isWithinVoidWindow(
  createdAt: Date | string,
  maxMinutes = 15,
  now = new Date()
): boolean {
  const createdMs =
    typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  const diffMs = now.getTime() - createdMs;

  return diffMs >= 0 && diffMs <= maxMinutes * 60 * 1000;
}
