import { hasSession } from "@/lib/auth";
import { db, today, unwrap, type Video } from "@/lib/db";
import { env } from "@/lib/env";
import { generateSyllabus } from "@/lib/gemini";
import { MAX_ANALYZABLE_SECONDS, type Syllabus } from "@/lib/syllabus";

export const maxDuration = 300;

export async function POST(_request: Request, ctx: RouteContext<"/api/syllabus/[id]">) {
  if (!(await hasSession())) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = unwrap(await db().from("syllabi").select("content").eq("video_id", id).maybeSingle()) as { content: Syllabus } | null;
  if (existing) return Response.json(existing.content);

  const video = unwrap(await db().from("videos").select("*").eq("id", id).maybeSingle()) as Video | null;
  if (!video) return Response.json({ error: "Video bulunamadı." }, { status: 404 });
  if (video.duration_seconds > MAX_ANALYZABLE_SECONDS) {
    return Response.json({ error: "Video 2 saatten uzun; ücretsiz katmanda tek seferde analiz edilemiyor." }, { status: 422 });
  }

  const usedToday = unwrap(
    await db().from("syllabi").select("videos(duration_seconds)").gte("created_at", `${today()}T00:00:00+03:00`),
  ) as unknown as { videos: { duration_seconds: number } }[];
  const usedSeconds = usedToday.reduce((sum, row) => sum + row.videos.duration_seconds, 0);
  if (usedSeconds + video.duration_seconds > env.dailyDeepAnalysisSeconds) {
    return Response.json({ error: "Günlük derin analiz sınırına ulaşıldı; yarın tekrar dene." }, { status: 429 });
  }

  try {
    const syllabus = await generateSyllabus({ id: video.id, title: video.title, durationSeconds: video.duration_seconds });
    unwrap(await db().from("syllabi").upsert({ video_id: video.id, content: syllabus, model: env.syllabusModel }));
    return Response.json(syllabus);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Syllabus üretilemedi: ${message.slice(0, 300)}` }, { status: 502 });
  }
}
