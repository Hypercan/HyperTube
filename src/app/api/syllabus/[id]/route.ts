import { after } from "next/server";
import { hasSession } from "@/lib/auth";
import { db, today, unwrap, type Video } from "@/lib/db";
import { env } from "@/lib/env";
import { friendlyGeminiError, geminiErrorDetail, generateSyllabus } from "@/lib/gemini";
import { MAX_ANALYZABLE_SECONDS, type Syllabus, type SyllabusState } from "@/lib/syllabus";

export const maxDuration = 300;

/** Leaves room to record a failure before the function is killed at maxDuration. */
const ANALYSIS_BUDGET_MS = 280_000;
const STALE_AFTER_MS = 310_000;

type Job = { status: "running" | "failed"; error: string | null; started_at: string };

async function currentState(id: string): Promise<SyllabusState> {
  const existing = unwrap(await db().from("syllabi").select("content").eq("video_id", id).maybeSingle()) as { content: Syllabus } | null;
  if (existing) return { status: "ready", syllabus: existing.content };

  const job = unwrap(await db().from("syllabus_jobs").select("status, error, started_at").eq("video_id", id).maybeSingle()) as Job | null;
  if (!job) return { status: "none" };
  if (job.status === "failed") return { status: "failed", error: job.error ?? "Bilinmeyen hata." };
  if (Date.now() - Date.parse(job.started_at) > STALE_AFTER_MS) {
    return { status: "failed", error: "Analiz 5 dakikalık sınırı aştı ve yarıda kesildi. Tekrar deneyebilirsin." };
  }
  return { status: "running", startedAt: job.started_at };
}

export async function GET(_request: Request, ctx: RouteContext<"/api/syllabus/[id]">) {
  const { id } = await ctx.params;
  return Response.json(await currentState(id));
}

export async function POST(_request: Request, ctx: RouteContext<"/api/syllabus/[id]">) {
  if (!(await hasSession())) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;

  const state = await currentState(id);
  if (state.status === "ready" || state.status === "running") return Response.json(state);

  const fail = (error: string, status: number) => Response.json({ status: "failed", error } satisfies SyllabusState, { status });

  const video = unwrap(await db().from("videos").select("*").eq("id", id).maybeSingle()) as Video | null;
  if (!video) return fail("Video bulunamadı.", 404);
  if (video.duration_seconds > MAX_ANALYZABLE_SECONDS) {
    return fail("Video 2 saatten uzun; ücretsiz katmanda tek seferde analiz edilemiyor.", 422);
  }

  const usedToday = unwrap(
    await db().from("syllabi").select("videos(duration_seconds)").gte("created_at", `${today()}T00:00:00+03:00`),
  ) as unknown as { videos: { duration_seconds: number } }[];
  const usedSeconds = usedToday.reduce((sum, row) => sum + row.videos.duration_seconds, 0);
  if (usedSeconds + video.duration_seconds > env.dailyDeepAnalysisSeconds) {
    return fail("Günlük derin analiz sınırına ulaşıldı; yarın tekrar dene.", 429);
  }

  const startedAt = new Date().toISOString();
  unwrap(
    await db()
      .from("syllabus_jobs")
      .upsert({ video_id: id, status: "running", error: null, detail: null, started_at: startedAt, finished_at: null }),
  );
  after(() => analyze(video));
  return Response.json({ status: "running", startedAt } satisfies SyllabusState, { status: 202 });
}

async function analyze(video: Video) {
  const started = Date.now();
  try {
    const { syllabus, model } = await generateSyllabus(
      { id: video.id, title: video.title, durationSeconds: video.duration_seconds },
      { deadline: started + ANALYSIS_BUDGET_MS },
    );
    unwrap(await db().from("syllabi").upsert({ video_id: video.id, content: syllabus, model }));
    unwrap(await db().from("syllabus_jobs").delete().eq("video_id", video.id));
  } catch (error) {
    const seconds = Math.round((Date.now() - started) / 1000);
    console.error(`Syllabus failed for ${video.id} after ${seconds}s`, error);
    unwrap(
      await db()
        .from("syllabus_jobs")
        .update({
          status: "failed",
          error: `Syllabus üretilemedi: ${friendlyGeminiError(error)}`,
          detail: `${seconds}s: ${geminiErrorDetail(error)}`,
          finished_at: new Date().toISOString(),
        })
        .eq("video_id", video.id),
    );
  }
}
