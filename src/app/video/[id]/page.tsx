import { Suspense } from "react";
import { Loading } from "@/components/loading";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, unwrap, type Video } from "@/lib/db";
import { formatDuration } from "@/lib/duration";
import type { Syllabus } from "@/lib/syllabus";
import { VideoStudy } from "./video-study";

type VideoWithAnalysis = Video & {
  screenings: { reason: string; score: number; goals: { name: string } | null } | null;
  syllabi: { content: Syllabus } | null;
};

async function VideoPageContent(props: PageProps<"/video/[id]">) {
  const { id } = await props.params;
  const video = unwrap(
    await db().from("videos").select("*, screenings(reason, score, goals(name)), syllabi(content)").eq("id", id).maybeSingle(),
  ) as VideoWithAnalysis | null;
  if (!video) notFound();

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Akış
      </Link>
      <VideoStudy
        video={{ id: video.id, title: video.title, durationSeconds: video.duration_seconds }}
        initialSyllabus={video.syllabi?.content ?? null}
        header={
          <div className="mt-4">
            <h1 className="text-xl font-semibold leading-snug">{video.title}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {video.channel_title} · {formatDuration(video.duration_seconds)} ·{" "}
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="hover:text-zinc-200">
                YouTube&apos;da aç ↗
              </a>
            </p>
            {video.screenings && (
              <p className="mt-3 text-sm text-zinc-300">
                <span className="text-[11px] uppercase tracking-wide text-amber-400/90">HyperTube analizi</span>
                {video.screenings.goals && <span className="text-zinc-500"> · {video.screenings.goals.name}</span>}
                <br />
                {video.screenings.reason}
              </p>
            )}
          </div>
        }
      />
    </main>
  );
}

export default function VideoPage(props: PageProps<"/video/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <VideoPageContent {...props} />
    </Suspense>
  );
}
