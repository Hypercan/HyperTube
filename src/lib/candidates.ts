import "server-only";
import { db, unwrap, type Goal } from "./db";
import { MIN_VIDEO_SECONDS } from "./duration";
import { screenCandidates, type CallOptions } from "./gemini";
import { fetchVideos, type YoutubeVideo } from "./youtube";

export type CandidateSource = "channel" | "discovery" | "search";

export function toVideoRow(v: YoutubeVideo) {
  return {
    id: v.id,
    channel_id: v.channelId,
    channel_title: v.channelTitle,
    title: v.title,
    description: v.description,
    published_at: v.publishedAt,
    duration_seconds: v.durationSeconds,
    thumbnail_url: v.thumbnailUrl,
    fetched_at: new Date().toISOString(),
  };
}

/** Stores the videos not seen before as Adaylar; Shorts and live streams never become one. */
export async function addCandidates(ids: string[], source: CandidateSource): Promise<number> {
  if (!ids.length) return 0;
  const known = unwrap(await db().from("videos").select("id").in("id", ids)) as { id: string }[];
  const knownIds = new Set(known.map((v) => v.id));
  const fresh = await fetchVideos(ids.filter((id) => !knownIds.has(id)));
  const rows = fresh.filter((v) => !v.isLive && v.durationSeconds >= MIN_VIDEO_SECONDS).map((v) => ({ ...toVideoRow(v), source }));
  if (rows.length) unwrap(await db().from("videos").upsert(rows));
  return rows.length;
}

export type ScreeningCandidate = { id: string; title: string; channel_title: string; description: string };

export async function screenAndSave(goals: Goal[], videos: ScreeningCandidate[], options: CallOptions): Promise<number> {
  const results = await screenCandidates(
    goals,
    videos.map((v) => ({ id: v.id, title: v.title, channelTitle: v.channel_title, description: v.description })),
    options,
  );
  if (results.length) {
    unwrap(
      await db()
        .from("screenings")
        .upsert(results.map((r) => ({ video_id: r.videoId, goal_id: r.goalId, score: r.score, reason: r.reason }))),
    );
  }
  return results.length;
}
