import "server-only";
import { db, today, unwrap, type Channel, type Goal } from "./db";
import { MIN_VIDEO_SECONDS } from "./duration";
import { buildFeed } from "./feed";
import { screenCandidates } from "./gemini";
import { fetchLatestUploadIds, fetchVideos, type YoutubeVideo } from "./youtube";

const SCREENING_BATCH = 25;
const RECENTLY_SHOWN_DAYS = 7;
const REFRESH_AFTER_DAYS = 25;
/** Keeps one run inside the serverless time limit; the rest is screened on the next run. */
const MAX_SCREENED_PER_RUN = 250;

export type PipelineReport = { newVideos: number; screened: number; feedSize: number; refreshed: number; deleted: number };

/** The daily job: Kaynak kanallar → Adaylar → Ön eleme → Akış. */
export async function runDailyPipeline(): Promise<PipelineReport> {
  const { refreshed, deleted } = await enforceRetention();
  const newVideos = await ingestChannels();
  const screened = await screenPending();
  const feedSize = await buildTodayFeed();
  return { newVideos, screened, feedSize, refreshed, deleted };
}

async function ingestChannels(): Promise<number> {
  const channels = unwrap(await db().from("channels").select("*")) as Channel[];
  let inserted = 0;

  for (const channel of channels) {
    const ids = await fetchLatestUploadIds(channel.uploads_playlist_id);
    const known = unwrap(await db().from("videos").select("id").in("id", ids)) as { id: string }[];
    const knownIds = new Set(known.map((v) => v.id));
    const fresh = await fetchVideos(ids.filter((id) => !knownIds.has(id)));
    const rows = fresh.filter((v) => !v.isLive).map(toVideoRow);
    if (rows.length) {
      unwrap(await db().from("videos").upsert(rows));
      inserted += rows.length;
    }
    unwrap(await db().from("channels").update({ last_synced_at: new Date().toISOString() }).eq("id", channel.id));
  }
  return inserted;
}

function toVideoRow(v: YoutubeVideo) {
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

async function screenPending(): Promise<number> {
  const goals = unwrap(await db().from("goals").select("id, name, description").order("created_at")) as Goal[];
  if (!goals.length) return 0;

  const pending = unwrap(
    await db()
      .from("videos")
      .select("id, title, channel_title, description, screenings(video_id)")
      .gte("duration_seconds", MIN_VIDEO_SECONDS)
      .is("screenings", null)
      .limit(MAX_SCREENED_PER_RUN),
  ) as { id: string; title: string; channel_title: string; description: string }[];

  let screened = 0;
  for (let i = 0; i < pending.length; i += SCREENING_BATCH) {
    const batch = pending.slice(i, i + SCREENING_BATCH);
    const results = await screenCandidates(
      goals,
      batch.map((v) => ({ id: v.id, title: v.title, channelTitle: v.channel_title, description: v.description })),
    );
    if (results.length) {
      unwrap(
        await db()
          .from("screenings")
          .upsert(results.map((r) => ({ video_id: r.videoId, goal_id: r.goalId, score: r.score, reason: r.reason }))),
      );
      screened += results.length;
    }
  }
  return screened;
}

async function buildTodayFeed(): Promise<number> {
  const date = today();
  const goals = unwrap(await db().from("goals").select("id")) as { id: string }[];
  const candidates = unwrap(
    await db().from("screenings").select("video_id, goal_id, score, videos!inner(duration_seconds)").not("goal_id", "is", null),
  ) as unknown as { video_id: string; goal_id: string; score: number; videos: { duration_seconds: number } }[];

  const recent = unwrap(
    await db().from("feed_entries").select("video_id").gte("feed_date", today(RECENTLY_SHOWN_DAYS)).lt("feed_date", date),
  ) as { video_id: string }[];

  const entries = buildFeed(
    candidates.map((c) => ({ videoId: c.video_id, goalId: c.goal_id, score: c.score, durationSeconds: c.videos.duration_seconds })),
    goals.map((g) => g.id),
    new Set(recent.map((r) => r.video_id)),
  );

  unwrap(await db().from("feed_entries").delete().eq("feed_date", date));
  if (entries.length) {
    unwrap(
      await db()
        .from("feed_entries")
        .insert(entries.map((e) => ({ feed_date: date, video_id: e.videoId, goal_id: e.goalId, rank: e.rank }))),
    );
  }
  return entries.length;
}

/**
 * YouTube API data may be stored for at most 30 days, so it is re-fetched before then;
 * videos YouTube no longer returns (deleted, made private) are dropped.
 */
async function enforceRetention(): Promise<{ refreshed: number; deleted: number }> {
  const refreshBefore = new Date(Date.now() - REFRESH_AFTER_DAYS * 86400_000).toISOString();
  const stale = unwrap(await db().from("videos").select("id").lt("fetched_at", refreshBefore)) as { id: string }[];
  if (!stale.length) return { refreshed: 0, deleted: 0 };

  const refreshed = await fetchVideos(stale.map((v) => v.id));
  if (refreshed.length) unwrap(await db().from("videos").upsert(refreshed.map(toVideoRow)));

  const alive = new Set(refreshed.map((v) => v.id));
  const gone = stale.map((v) => v.id).filter((id) => !alive.has(id));
  if (gone.length) unwrap(await db().from("videos").delete().in("id", gone));

  return { refreshed: refreshed.length, deleted: gone.length };
}

/** Goals changed: every Ön eleme is stale, so the next run re-screens from scratch. */
export async function invalidateScreenings(): Promise<void> {
  unwrap(await db().from("screenings").delete().gte("score", 0));
}
