import "server-only";
import { addCandidates, screenAndSave, toVideoRow, type ScreeningCandidate } from "./candidates";
import { db, today, unwrap, type Channel, type Goal } from "./db";
import { MIN_VIDEO_SECONDS } from "./duration";
import { buildFeed } from "./feed";
import { friendlyGeminiError, generateDiscoveryQueries } from "./gemini";
import { fetchLatestUploadIds, fetchVideos, searchVideoIds } from "./youtube";

const SCREENING_BATCH = 25;
const RECENTLY_SHOWN_DAYS = 7;
const REFRESH_AFTER_DAYS = 25;
const MAX_SCREENED_PER_RUN = 250;
/** Time kept back after Ön eleme so the Akış is always rebuilt before the serverless limit. */
const FEED_RESERVE_MS = 25_000;

/** Keşif araması costs one search.list call per query; the rest of the ~100/day is left for manual Arama. */
const DISCOVERY_QUERIES_PER_GOAL = 3;
const DISCOVERY_RESULTS_PER_QUERY = 15;
const MAX_DISCOVERY_GOALS_PER_RUN = 8;
const DISCOVER_EVERY_MS = 20 * 3600_000;

export type PipelineReport = {
  newVideos: number;
  discovered: number;
  screened: number;
  pending: number;
  feedSize: number;
  refreshed: number;
  deleted: number;
  screeningError: string | null;
  discoveryError: string | null;
};

/**
 * The daily job: Kaynak kanallar + Keşif araması → Adaylar → Ön eleme → Akış. Ön eleme stops
 * when the time budget runs out or Gemini is unavailable; whatever was screened still makes an
 * Akış, and the rest is picked up by the next run.
 */
export async function runDailyPipeline({ budgetMs }: { budgetMs: number }): Promise<PipelineReport> {
  const deadline = Date.now() + budgetMs;
  const { refreshed, deleted } = await enforceRetention();
  const newVideos = await ingestChannels();
  const discovery = await discover(deadline - FEED_RESERVE_MS);
  const { screened, pending, error } = await screenPending(deadline - FEED_RESERVE_MS);
  const feedSize = await buildTodayFeed();
  return {
    newVideos,
    discovered: discovery.inserted,
    screened,
    pending,
    feedSize,
    refreshed,
    deleted,
    screeningError: error,
    discoveryError: discovery.error,
  };
}

async function ingestChannels(): Promise<number> {
  const channels = unwrap(await db().from("channels").select("*")) as Channel[];
  const syncedRecently = (c: Channel) => c.last_synced_at && Date.now() - Date.parse(c.last_synced_at) < 3 * 3600_000;
  let inserted = 0;

  for (const channel of channels.filter((c) => !syncedRecently(c))) {
    inserted += await addCandidates(await fetchLatestUploadIds(channel.uploads_playlist_id), "channel");
    unwrap(await db().from("channels").update({ last_synced_at: new Date().toISOString() }).eq("id", channel.id));
  }
  return inserted;
}

async function discover(deadline: number): Promise<{ inserted: number; error: string | null }> {
  const goals = unwrap(
    await db().from("goals").select("id, name, description, discovery_queries, discovered_at").order("created_at"),
  ) as (Goal & { discovery_queries: string[]; discovered_at: string | null })[];
  const due = goals
    .filter((g) => !g.discovered_at || Date.now() - Date.parse(g.discovered_at) > DISCOVER_EVERY_MS)
    .slice(0, MAX_DISCOVERY_GOALS_PER_RUN);
  if (!due.length || deadline - Date.now() < 60_000) return { inserted: 0, error: null };

  let inserted = 0;
  try {
    const queries = await generateDiscoveryQueries(due, DISCOVERY_QUERIES_PER_GOAL, { deadline });
    for (const goal of due) {
      const list = queries.get(goal.id);
      if (!list) continue;
      const ids = new Set<string>();
      for (const [i, query] of list.entries()) {
        const duration = i < list.length - 1 ? "long" : "medium";
        for (const id of await searchVideoIds(query, { duration, maxResults: DISCOVERY_RESULTS_PER_QUERY })) ids.add(id);
      }
      inserted += await addCandidates([...ids], "discovery");
      unwrap(
        await db().from("goals").update({ discovery_queries: list, discovered_at: new Date().toISOString() }).eq("id", goal.id),
      );
    }
  } catch (e) {
    return { inserted, error: friendlyGeminiError(e) };
  }
  return { inserted, error: null };
}

async function screenPending(deadline: number): Promise<{ screened: number; pending: number; error: string | null }> {
  const goals = unwrap(await db().from("goals").select("id, name, description").order("created_at")) as Goal[];
  if (!goals.length) return { screened: 0, pending: 0, error: null };

  const pending = unwrap(
    await db()
      .from("videos")
      .select("id, title, channel_title, description, screenings(video_id)")
      .gte("duration_seconds", MIN_VIDEO_SECONDS)
      .is("screenings", null)
      .order("fetched_at", { ascending: false })
      .limit(MAX_SCREENED_PER_RUN),
  ) as ScreeningCandidate[];

  let screened = 0;
  let error: string | null = null;
  for (let i = 0; i < pending.length; i += SCREENING_BATCH) {
    if (deadline - Date.now() < 20_000) break;
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 4_000));
    try {
      screened += await screenAndSave(goals, pending.slice(i, i + SCREENING_BATCH), { deadline });
    } catch (e) {
      error = friendlyGeminiError(e);
      break;
    }
  }
  return { screened, pending: Math.max(0, pending.length - screened), error };
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
