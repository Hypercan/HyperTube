import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export type Goal = { id: string; name: string; description: string };

export type Channel = {
  id: string;
  title: string;
  handle: string | null;
  uploads_playlist_id: string;
  thumbnail_url: string | null;
  last_synced_at: string | null;
};

export type Video = {
  id: string;
  channel_id: string;
  channel_title: string;
  title: string;
  description: string;
  published_at: string | null;
  duration_seconds: number;
  thumbnail_url: string | null;
};

export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Calendar day in Türkiye, which is when a new Akış starts. */
export function today(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}
