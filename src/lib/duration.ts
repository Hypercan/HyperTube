const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export function parseIsoDuration(value: string): number {
  const match = ISO_DURATION.exec(value);
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match.map((part) => Number(part ?? 0));
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const DURATION_FILTERS = {
  "20+": { label: "20 dk+", min: 20 * 60, max: Infinity },
  "60+": { label: "60 dk+", min: 60 * 60, max: Infinity },
  "4-20": { label: "4–20 dk", min: 4 * 60, max: 20 * 60 },
  hepsi: { label: "Hepsi", min: 4 * 60, max: Infinity },
} as const;

export type DurationFilter = keyof typeof DURATION_FILTERS;

export function parseDurationFilter(value: string | undefined): DurationFilter {
  return value && value in DURATION_FILTERS ? (value as DurationFilter) : "20+";
}

/** Shorts and clips never enter HyperTube. */
export const MIN_VIDEO_SECONDS = 4 * 60;
