"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/duration";
import type { Syllabus, SyllabusState } from "@/lib/syllabus";

type YTPlayer = { seekTo(seconds: number, allowSeekAhead: boolean): void; playVideo(): void; destroy(): void };
type YTNamespace = { Player: new (el: HTMLElement, options: { videoId: string; playerVars?: Record<string, number> }) => YTPlayer };

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
}

type State = SyllabusState | { status: "checking" };

const POLL_MS = 5_000;

async function requestState(videoId: string, method: "GET" | "POST"): Promise<SyllabusState> {
  try {
    const res = await fetch(`/api/syllabus/${videoId}`, { method, cache: "no-store" });
    const body = (await res.json()) as SyllabusState | { error: string };
    return "status" in body ? body : { status: "failed", error: body.error };
  } catch {
    return { status: "failed", error: "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene." };
  }
}

export function VideoStudy({
  video,
  initialSyllabus,
  header,
}: {
  video: { id: string; title: string; durationSeconds: number };
  initialSyllabus: Syllabus | null;
  header: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [state, setState] = useState<State>(initialSyllabus ? { status: "ready", syllabus: initialSyllabus } : { status: "checking" });

  useEffect(() => {
    let cancelled = false;
    // The IFrame API replaces its target element, so it gets a child React doesn't own.
    const host = container.current;
    const target = document.createElement("div");
    host?.appendChild(target);
    loadIframeApi().then((YT) => {
      if (!cancelled) player.current = new YT.Player(target, { videoId: video.id, playerVars: { rel: 0 } });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      host?.replaceChildren();
    };
  }, [video.id]);

  const start = useCallback(async () => {
    setState({ status: "checking" });
    setState(await requestState(video.id, "POST"));
  }, [video.id]);

  useEffect(() => {
    if (initialSyllabus) return;
    let cancelled = false;
    requestState(video.id, "GET").then(async (current) => {
      if (cancelled) return;
      if (current.status !== "none") return setState(current);
      const started = await requestState(video.id, "POST");
      if (!cancelled) setState(started);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSyllabus, video.id]);

  const running = state.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const current = await requestState(video.id, "GET");
      if (current.status !== "running") setState(current);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, video.id]);

  const seek = (seconds: number) => {
    player.current?.seekTo(seconds, true);
    player.current?.playVideo();
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <div ref={container} className="size-full [&_iframe]:size-full" />
        </div>
        {header}
      </div>

      <aside className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <p className="text-[11px] uppercase tracking-wide text-amber-400/90">HyperTube analizi · Syllabus</p>
        {(state.status === "checking" || state.status === "none") && <p className="mt-4 animate-pulse text-sm text-zinc-400">Hazırlanıyor…</p>}
        {state.status === "running" && <Running startedAt={state.startedAt} durationSeconds={video.durationSeconds} />}
        {state.status === "failed" && (
          <div className="mt-4 grid gap-3 text-sm">
            <p className="text-red-300">{state.error}</p>
            <button onClick={start} className="justify-self-start rounded-md border border-zinc-700 px-3 py-1.5 hover:border-zinc-500">
              Tekrar dene
            </button>
          </div>
        )}
        {state.status === "ready" && <SyllabusView syllabus={state.syllabus} onSeek={seek} />}
      </aside>
    </div>
  );
}

function Running({ startedAt, durationSeconds }: { startedAt: string; durationSeconds: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));

  return (
    <div className="mt-4 grid gap-2 text-sm">
      <p className="animate-pulse text-zinc-300">Gemini videoyu izliyor ve syllabus hazırlıyor… {formatDuration(elapsed)}</p>
      <p className="text-xs text-zinc-500">
        {durationSeconds >= 30 * 60 ? "Uzun videolarda bu 2–4 dakika sürebilir." : "Genelde 1–2 dakika sürer."} Sayfadan çıkabilirsin; analiz arka planda
        devam eder.
      </p>
    </div>
  );
}

function SyllabusView({ syllabus, onSeek }: { syllabus: Syllabus; onSeek: (seconds: number) => void }) {
  return (
    <div className="mt-3 grid gap-6 text-sm">
      <section>
        <h2 className="mb-1 font-semibold text-zinc-100">Ana fikir</h2>
        <p className="leading-relaxed text-zinc-300">{syllabus.mainIdea}</p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-zinc-100">Kime hitap ediyor</h2>
        <p className="text-zinc-300">{syllabus.audience}</p>
        {syllabus.prerequisites.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-zinc-400">
            {syllabus.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-zinc-100">Bölümler</h2>
        <ol className="grid gap-1">
          {syllabus.chapters.map((chapter) => (
            <li key={`${chapter.startSeconds}-${chapter.title}`}>
              <button
                onClick={() => onSeek(chapter.startSeconds)}
                className="flex w-full gap-3 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800"
              >
                <span className="w-14 shrink-0 font-mono text-xs leading-5 text-amber-400">{formatDuration(chapter.startSeconds)}</span>
                <span className="text-zinc-200">{chapter.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-zinc-100">Anahtar çıkarımlar</h2>
        <ul className="grid list-disc gap-1 pl-5 text-zinc-300">
          {syllabus.keyTakeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
