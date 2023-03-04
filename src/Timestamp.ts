/** Milliseconds and milliseconds since epoch */
export type MillisSinceEpoch = number;
export type Millis = number;
export type Minutes = number;

/**
 * Returns difference between timestamps.
 */
export function differenceMillis(timestamp1: MillisSinceEpoch, timestamp2: MillisSinceEpoch): Millis {
  return timestamp1 - timestamp2;
}

/**
 * Returns the current time as milliseconds since epoch.
 */
export function millisNow(): MillisSinceEpoch {
  return Date.now();
}

/**
 * Converts minutes to milliseconds.
 */
export function minutesToMillis(minutes: Minutes): Millis {
  return minutes * 60 * 1000;
}
