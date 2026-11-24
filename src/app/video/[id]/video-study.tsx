"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/duration";
import type { Syllabus } from "@/lib/syllabus";

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

type State = { status: "ready"; syllabus: Syllabus } | { status: "loading" } | { status: "error"; message: string };

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
  const requested = useRef(false);
  const [state, setState] = useState<State>(initialSyllabus ? { status: "ready", syllabus: initialSyllabus } : { status: "loading" });

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

  const generate = useCallback(async () => {
    setState({ status: "loading" });
    const res = await fetch(`/api/syllabus/${video.id}`, { method: "POST" });
    const body = await res.json().catch(() => ({ error: "Beklenmeyen yanıt." }));
    setState(res.ok ? { status: "ready", syllabus: body as Syllabus } : { status: "error", message: body.error });
  }, [video.id]);

  useEffect(() => {
    if (initialSyllabus || requested.current) return;
    requested.current = true;
    generate();
  }, [initialSyllabus, generate]);

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
        {state.status === "loading" && (
          <p className="mt-4 animate-pulse text-sm text-zinc-400">Gemini videoyu izliyor ve syllabus hazırlıyor… (30–90 sn)</p>
        )}
        {state.status === "error" && (
          <div className="mt-4 grid gap-3 text-sm">
            <p className="text-red-300">{state.message}</p>
            <button onClick={generate} className="justify-self-start rounded-md border border-zinc-700 px-3 py-1.5 hover:border-zinc-500">
              Tekrar dene
            </button>
          </div>
        )}
        {state.status === "ready" && <SyllabusView syllabus={state.syllabus} onSeek={seek} />}
      </aside>
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
