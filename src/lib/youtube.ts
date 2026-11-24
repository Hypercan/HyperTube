import "server-only";
import type { ChannelRef } from "./channel-input";
import { parseIsoDuration } from "./duration";
import { env } from "./env";

const API = "https://www.googleapis.com/youtube/v3";

type Thumbnails = Record<string, { url: string } | undefined>;

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", env.youtubeApiKey);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export type YoutubeChannel = {
  id: string;
  title: string;
  handle: string | null;
  uploadsPlaylistId: string;
  thumbnailUrl: string | null;
};

export async function fetchChannel(ref: ChannelRef): Promise<YoutubeChannel | null> {
  const lookupParam = { id: "id", handle: "forHandle", username: "forUsername" }[ref.kind];
  const lookup = { [lookupParam]: ref.value };
  const data = await call<{
    items?: {
      id: string;
      snippet: { title: string; customUrl?: string; thumbnails: Thumbnails };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }[];
  }>("channels", { part: "snippet,contentDetails", ...lookup });

  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet.title,
    handle: item.snippet.customUrl ?? null,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    thumbnailUrl: item.snippet.thumbnails.default?.url ?? null,
  };
}

export async function fetchLatestUploadIds(uploadsPlaylistId: string): Promise<string[]> {
  const data = await call<{ items?: { contentDetails: { videoId: string } }[] }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: "50",
  });
  return (data.items ?? []).map((item) => item.contentDetails.videoId);
}

export type YoutubeVideo = {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  isLive: boolean;
};

export async function fetchVideos(ids: string[]): Promise<YoutubeVideo[]> {
  const videos: YoutubeVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await call<{
      items?: {
        id: string;
        snippet: {
          channelId: string;
          channelTitle: string;
          title: string;
          description: string;
          publishedAt: string;
          thumbnails: Thumbnails;
          liveBroadcastContent: string;
        };
        contentDetails: { duration: string };
      }[];
    }>("videos", { part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(",") });

    for (const item of data.items ?? []) {
      const t = item.snippet.thumbnails;
      videos.push({
        id: item.id,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        durationSeconds: parseIsoDuration(item.contentDetails.duration),
        thumbnailUrl: (t.maxres ?? t.high ?? t.medium ?? t.default)?.url ?? null,
        isLive: item.snippet.liveBroadcastContent !== "none",
      });
    }
  }
  return videos;
}
