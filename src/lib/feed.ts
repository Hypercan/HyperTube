import { MIN_VIDEO_SECONDS } from "./duration";

export type ScreenedCandidate = {
  videoId: string;
  goalId: string | null;
  score: number;
  durationSeconds: number;
};

export type FeedEntry = { videoId: string; goalId: string; rank: number };

export type FeedOptions = {
  perBucket: number;
  minPerGoal: number;
  minScore: number;
};

export const DEFAULT_FEED_OPTIONS: FeedOptions = { perBucket: 20, minPerGoal: 2, minScore: 50 };

const LONGFORM_SECONDS = 20 * 60;

/**
 * Builds the day's Akış. Longform and mid-length videos get separate slots so the
 * default "20 dk+" filter is never starved by shorter videos; duration only buckets,
 * it never affects the score (ADR-0001).
 */
export function buildFeed(
  candidates: ScreenedCandidate[],
  goalIds: string[],
  recentlyShown: Set<string>,
  options: FeedOptions = DEFAULT_FEED_OPTIONS,
): FeedEntry[] {
  const eligible = candidates.filter(
    (c): c is ScreenedCandidate & { goalId: string } =>
      c.goalId !== null && goalIds.includes(c.goalId) && c.score >= options.minScore && c.durationSeconds >= MIN_VIDEO_SECONDS,
  );
  const longform = eligible.filter((c) => c.durationSeconds >= LONGFORM_SECONDS);
  const midLength = eligible.filter((c) => c.durationSeconds < LONGFORM_SECONDS);

  const picked = [...pickBucket(longform, goalIds, recentlyShown, options), ...pickBucket(midLength, goalIds, recentlyShown, options)];
  return picked.sort((a, b) => b.score - a.score).map((c, index) => ({ videoId: c.videoId, goalId: c.goalId, rank: index + 1 }));
}

function pickBucket<T extends ScreenedCandidate & { goalId: string }>(
  bucket: T[],
  goalIds: string[],
  recentlyShown: Set<string>,
  { perBucket, minPerGoal }: FeedOptions,
): T[] {
  const byScore = [...bucket].sort((a, b) => b.score - a.score);
  const fresh = byScore.filter((c) => !recentlyShown.has(c.videoId));
  const stale = byScore.filter((c) => recentlyShown.has(c.videoId));

  const picked: T[] = [];
  const has = (c: T) => picked.some((p) => p.videoId === c.videoId);

  for (const goalId of goalIds) {
    for (const c of fresh.filter((f) => f.goalId === goalId).slice(0, minPerGoal)) {
      if (picked.length < perBucket) picked.push(c);
    }
  }
  for (const c of [...fresh, ...stale]) {
    if (picked.length >= perBucket) break;
    if (!has(c)) picked.push(c);
  }
  return picked;
}
