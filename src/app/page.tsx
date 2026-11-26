import { Suspense } from "react";
import { Chip } from "@/components/chip";
import { Loading } from "@/components/loading";
import { VideoCard } from "@/components/video-card";
import Link from "next/link";
import { hasSession } from "@/lib/auth";
import type { CandidateSource } from "@/lib/candidates";
import { db, today, unwrap } from "@/lib/db";
import { DURATION_FILTERS, parseDurationFilter, type DurationFilter } from "@/lib/duration";
import type { Syllabus } from "@/lib/syllabus";

type FeedRow = {
  rank: number;
  goal_id: string;
  goals: { name: string };
  videos: {
    id: string;
    title: string;
    channel_title: string;
    duration_seconds: number;
    thumbnail_url: string | null;
    source: CandidateSource;
    screenings: { reason: string } | null;
    syllabi: { content: Syllabus } | null;
  };
};

async function FeedPageContent(props: PageProps<"/">) {
  const params = await props.searchParams;
  const filter = parseDurationFilter(typeof params.sure === "string" ? params.sure : undefined);
  const isOwner = await hasSession();
  const goalFilter = isOwner && typeof params.hedef === "string" ? params.hedef : undefined;

  const goals = unwrap(await db().from("goals").select("id, name").order("created_at")) as { id: string; name: string }[];
  const latest = unwrap(
    await db().from("feed_entries").select("feed_date").lte("feed_date", today()).order("feed_date", { ascending: false }).limit(1),
  ) as { feed_date: string }[];
  const feedDate = latest[0]?.feed_date;

  const rows = feedDate
    ? (unwrap(
        await db()
          .from("feed_entries")
          .select(
            "rank, goal_id, goals(name), videos(id, title, channel_title, duration_seconds, thumbnail_url, source, screenings(reason), syllabi(content))",
          )
          .eq("feed_date", feedDate)
          .order("rank"),
      ) as unknown as FeedRow[])
    : [];

  const { min, max } = DURATION_FILTERS[filter];
  const visible = rows
    .filter((r) => r.videos.duration_seconds >= min && r.videos.duration_seconds < max)
    .filter((r) => !goalFilter || r.goal_id === goalFilter)
    .slice(0, 20);

  const href = (next: { sure?: DurationFilter; hedef?: string | null }) => {
    const q = new URLSearchParams();
    const sure = next.sure ?? filter;
    const hedef = next.hedef === undefined ? goalFilter : next.hedef;
    if (sure !== "20+") q.set("sure", sure);
    if (hedef) q.set("hedef", hedef);
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  if (!isOwner && (!feedDate || !goals.length)) return <Empty>Akış henüz hazırlanmadı. Biraz sonra tekrar uğra.</Empty>;

  if (!goals.length) {
    return (
      <Empty>
        Henüz bir hedef yok. <Link href="/ayarlar" className="text-amber-400 underline">Hedeflerini ve kaynak kanallarını ekle</Link>,
        sonra Akış&apos;ı yenile.
      </Empty>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {(Object.keys(DURATION_FILTERS) as DurationFilter[]).map((key) => (
          <Chip key={key} href={href({ sure: key })} active={key === filter}>
            {DURATION_FILTERS[key].label}
          </Chip>
        ))}
        {isOwner && (
          <>
            <span className="mx-2 h-5 w-px bg-zinc-800" />
            <Chip href={href({ hedef: null })} active={!goalFilter}>
              Tüm hedefler
            </Chip>
            {goals.map((goal) => (
              <Chip key={goal.id} href={href({ hedef: goal.id })} active={goal.id === goalFilter}>
                {goal.name}
              </Chip>
            ))}
          </>
        )}
        {feedDate && <span className="ml-auto text-xs text-zinc-500">Akış: {feedDate}</span>}
      </div>

      {!feedDate ? (
        <Empty>
          Akış henüz hazırlanmadı. <Link href="/ayarlar" className="text-amber-400 underline">Kaynak kanal ekleyip Akış&apos;ı yenile.</Link>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>Bu filtrelerle bugünün Akış&apos;ında video yok. Süre filtresini değiştirmeyi dene.</Empty>
      ) : (
        <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(({ videos: video, goals: goal }) => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              channelTitle={video.channel_title}
              durationSeconds={video.duration_seconds}
              thumbnailUrl={video.thumbnail_url}
              goalName={isOwner ? goal.name : undefined}
              text={video.syllabi?.content.mainIdea ?? video.screenings?.reason ?? null}
              badge={video.source === "channel" ? undefined : "Keşif"}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto max-w-xl px-6 py-24 text-center text-zinc-400">{children}</p>;
}

export default function FeedPage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <FeedPageContent {...props} />
    </Suspense>
  );
}
