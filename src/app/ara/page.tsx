import { Suspense } from "react";
import { Chip } from "@/components/chip";
import { Loading } from "@/components/loading";
import { VideoCard } from "@/components/video-card";
import { DURATION_FILTERS, parseDurationFilter, type DurationFilter } from "@/lib/duration";
import { searchAndScreen } from "@/lib/search";

export const maxDuration = 60;

async function SearchPageContent(props: PageProps<"/ara">) {
  const params = await props.searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const filter = parseDurationFilter(typeof params.sure === "string" ? params.sure : undefined);

  const href = (sure: DurationFilter) => {
    const q = new URLSearchParams({ q: query });
    if (sure !== "20+") q.set("sure", sure);
    return `/ara?${q}`;
  };

  if (!query) {
    return <Empty>Yukarıdaki kutuya ne öğrenmek istediğini yaz. Sonuçlar hedeflerine göre puanlanıp sıralanır; Shorts gelmez.</Empty>;
  }

  let result;
  try {
    result = await searchAndScreen(query, filter);
  } catch (error) {
    return <Empty>Arama yapılamadı: {error instanceof Error ? error.message : String(error)}</Empty>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <h1 className="mr-3 text-base text-zinc-300">
          <span className="text-zinc-100">“{query}”</span> için sonuçlar
        </h1>
        {(Object.keys(DURATION_FILTERS) as DurationFilter[]).map((key) => (
          <Chip key={key} href={href(key)} active={key === filter}>
            {DURATION_FILTERS[key].label}
          </Chip>
        ))}
      </div>

      {result.screeningError && (
        <p className="mb-6 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          Sonuçlar puanlanamadı, YouTube sırasıyla gösteriliyor. {result.screeningError}
        </p>
      )}

      {result.hits.length === 0 ? (
        <Empty>Bu süre filtresiyle sonuç yok. Başka bir süre seçmeyi ya da aramayı değiştirmeyi dene.</Empty>
      ) : (
        <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.hits.map((hit) => (
            <VideoCard
              key={hit.id}
              id={hit.id}
              title={hit.title}
              channelTitle={hit.channelTitle}
              durationSeconds={hit.durationSeconds}
              thumbnailUrl={hit.thumbnailUrl}
              goalName={hit.goalName}
              text={hit.reason}
              score={hit.score}
              muted={hit.score != null && (hit.score < 50 || !hit.goalName)}
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

export default function SearchPage(props: PageProps<"/ara">) {
  return (
    <Suspense fallback={<Loading />}>
      <SearchPageContent {...props} />
    </Suspense>
  );
}
