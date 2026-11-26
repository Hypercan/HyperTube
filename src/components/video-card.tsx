import Link from "next/link";
import { formatDuration } from "@/lib/duration";

export type VideoCardProps = {
  id: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  /** Omitted for visitors, who never see Hedef names (ADR-0006). */
  goalName?: string | null;
  text: string | null;
  badge?: string;
  score?: number | null;
  muted?: boolean;
};

export function VideoCard(video: VideoCardProps) {
  return (
    <li className={video.muted ? "opacity-50 transition hover:opacity-100" : undefined}>
      <Link href={`/video/${video.id}`} className="group block">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900">
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube images must be shown unmodified
            <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:opacity-90" />
          )}
          {video.badge && (
            <span className="absolute top-1.5 left-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-medium text-zinc-950">{video.badge}</span>
          )}
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 font-medium leading-snug group-hover:text-amber-300">{video.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{video.channelTitle}</p>
      </Link>
      {video.text && (
        <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
          <p className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
            <span className="text-amber-400/90">HyperTube analizi</span>
            {video.goalName !== undefined && <>· {video.goalName ?? "Hedeflerinle ilgisiz"}</>}
            {video.score != null && <span className="ml-auto font-mono text-zinc-400">{video.score}</span>}
          </p>
          <p className="text-zinc-300">{video.text}</p>
        </div>
      )}
    </li>
  );
}
