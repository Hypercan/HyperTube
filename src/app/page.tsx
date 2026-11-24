import { Suspense } from "react";
import { Loading } from "@/components/loading";
import Link from "next/link";
import { db, today, unwrap } from "@/lib/db";
import { DURATION_FILTERS, formatDuration, parseDurationFilter, type DurationFilter } from "@/lib/duration";
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
    screenings: { reason: string } | null;
    syllabi: { content: Syllabus } | null;
  };
};

async function FeedPageContent(props: PageProps<"/">) {
  const params = await props.searchParams;
  const filter = parseDurationFilter(typeof params.sure === "string" ? params.sure : undefined);
  const goalFilter = typeof params.hedef === "string" ? params.hedef : undefined;

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
            "rank, goal_id, goals(name), videos(id, title, channel_title, duration_seconds, thumbnail_url, screenings(reason), syllabi(content))",
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
        <span className="mx-2 h-5 w-px bg-zinc-800" />
        <Chip href={href({ hedef: null })} active={!goalFilter}>
          Tüm hedefler
        </Chip>
        {goals.map((goal) => (
          <Chip key={goal.id} href={href({ hedef: goal.id })} active={goal.id === goalFilter}>
            {goal.name}
          </Chip>
        ))}
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
          {visible.map((row) => (
            <VideoCard key={row.videos.id} row={row} />
          ))}
        </ul>
      )}
    </main>
  );
}

function VideoCard({ row }: { row: FeedRow }) {
  const video = row.videos;
  const mainIdea = video.syllabi?.content.mainIdea;
  return (
    <li>
      <Link href={`/video/${video.id}`} className="group block">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900">
          {video.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube images must be shown unmodified
            <img src={video.thumbnail_url} alt="" className="size-full object-cover transition group-hover:opacity-90" />
          )}
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs">
            {formatDuration(video.duration_seconds)}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 font-medium leading-snug group-hover:text-amber-300">{video.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{video.channel_title}</p>
      </Link>
      <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
        <p className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
          <span className="text-amber-400/90">HyperTube analizi</span>· {row.goals.name}
        </p>
        <p className="text-zinc-300">{mainIdea ?? video.screenings?.reason}</p>
      </div>
    </li>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${active ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
    >
      {children}
    </Link>
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
