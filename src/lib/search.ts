import "server-only";
import { addCandidates, screenAndSave } from "./candidates";
import { db, unwrap, type Goal } from "./db";
import { DURATION_FILTERS, type DurationFilter } from "./duration";
import { friendlyGeminiError } from "./gemini";
import { searchVideoIds } from "./youtube";

const YOUTUBE_DURATION: Record<DurationFilter, "long" | "medium" | "any"> = {
  "20+": "long",
  "60+": "long",
  "4-20": "medium",
  hepsi: "any",
};

export type SearchHit = {
  id: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  goalName: string | null;
  score: number | null;
  reason: string | null;
};

type Row = {
  id: string;
  title: string;
  channel_title: string;
  description: string;
  duration_seconds: number;
  thumbnail_url: string | null;
  screenings: { score: number; reason: string; goals: { name: string } | null } | null;
};

async function load(ids: string[], filter: DurationFilter): Promise<Row[]> {
  const rows = unwrap(
    await db()
      .from("videos")
      .select("id, title, channel_title, description, duration_seconds, thumbnail_url, screenings(score, reason, goals(name))")
      .in("id", ids),
  ) as unknown as Row[];
  const { min, max } = DURATION_FILTERS[filter];
  return rows.filter((r) => r.duration_seconds >= min && r.duration_seconds < max);
}

/** Arama: YouTube results, each run through Ön eleme so they can be ranked by the Hedefler. */
export async function searchAndScreen(query: string, filter: DurationFilter): Promise<{ hits: SearchHit[]; screeningError: string | null }> {
  const ids = await searchVideoIds(query, { duration: YOUTUBE_DURATION[filter] });
  await addCandidates(ids, "search");

  let rows = await load(ids, filter);
  let screeningError: string | null = null;
  const unscreened = rows.filter((r) => !r.screenings);
  const goals = unwrap(await db().from("goals").select("id, name, description").order("created_at")) as Goal[];
  if (goals.length && unscreened.length) {
    try {
      await screenAndSave(goals, unscreened, { deadline: Date.now() + 45_000 });
      rows = await load(ids, filter);
    } catch (error) {
      screeningError = friendlyGeminiError(error);
    }
  }

  const youtubeOrder = new Map(ids.map((id, i) => [id, i]));
  return {
    hits: rows
      .map((r) => ({
        id: r.id,
        title: r.title,
        channelTitle: r.channel_title,
        durationSeconds: r.duration_seconds,
        thumbnailUrl: r.thumbnail_url,
        goalName: r.screenings?.goals?.name ?? null,
        score: r.screenings?.score ?? null,
        reason: r.screenings?.reason ?? null,
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || youtubeOrder.get(a.id)! - youtubeOrder.get(b.id)!),
    screeningError,
  };
}
