"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseChannelInput } from "@/lib/channel-input";
import { db, unwrap } from "@/lib/db";
import { friendlyGeminiError } from "@/lib/gemini";
import { invalidateScreenings, runDailyPipeline } from "@/lib/pipeline";
import { fetchChannel } from "@/lib/youtube";

function back(message: string, kind: "ok" | "hata" = "ok"): never {
  redirect(`/ayarlar?${kind}=${encodeURIComponent(message)}`);
}

export async function addGoal(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) back("Hedefin bir adı olmalı.", "hata");

  unwrap(await db().from("goals").insert({ name, description }));
  await invalidateScreenings();
  revalidatePath("/", "layout");
  back(`"${name}" hedefi eklendi. Ön eleme bir sonraki yenilemede yeniden yapılacak.`);
}

export async function deleteGoal(formData: FormData) {
  await requireSession();
  unwrap(await db().from("goals").delete().eq("id", String(formData.get("id"))));
  await invalidateScreenings();
  revalidatePath("/", "layout");
  back("Hedef silindi.");
}

export async function addChannel(formData: FormData) {
  await requireSession();
  const ref = parseChannelInput(String(formData.get("channel") ?? ""));
  if (!ref) back("Kanal tanınmadı. Kanal linki, @handle ya da UC… ile başlayan kanal ID'si girin.", "hata");

  let channel;
  try {
    channel = await fetchChannel(ref);
  } catch (error) {
    back(`YouTube'a ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`, "hata");
  }
  if (!channel) back("YouTube'da böyle bir kanal bulunamadı.", "hata");

  unwrap(
    await db().from("channels").upsert({
      id: channel.id,
      title: channel.title,
      handle: channel.handle,
      uploads_playlist_id: channel.uploadsPlaylistId,
      thumbnail_url: channel.thumbnailUrl,
    }),
  );
  revalidatePath("/ayarlar");
  back(`${channel.title} kaynak kanal olarak eklendi.`);
}

export async function deleteChannel(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id"));
  unwrap(await db().from("videos").delete().eq("channel_id", id));
  unwrap(await db().from("channels").delete().eq("id", id));
  revalidatePath("/", "layout");
  back("Kanal ve videoları silindi.");
}

export async function refreshFeed() {
  await requireSession();
  let report;
  try {
    report = await runDailyPipeline({ budgetMs: 150_000 });
  } catch (error) {
    back(`Yenileme yarıda kaldı: ${friendlyGeminiError(error)}`, "hata");
  }
  revalidatePath("/", "layout");

  const summary = `${report.newVideos} kanal adayı, ${report.discovered} keşif adayı, ${report.screened} ön eleme, Akış'ta ${report.feedSize} video.`;
  if (report.screeningError) back(`Akış güncellendi (${summary}) Ön eleme durdu: ${report.screeningError}`, "hata");
  if (report.discoveryError) back(`Akış güncellendi (${summary}) Keşif araması yapılamadı: ${report.discoveryError}`, "hata");
  if (report.pending > 0) back(`Akış güncellendi: ${summary} ${report.pending} aday hâlâ sırada; kalanlar için Yenile'ye tekrar bas.`);
  back(`Akış yenilendi: ${summary}`);
}
