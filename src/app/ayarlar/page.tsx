import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { SubmitButton } from "@/components/submit-button";
import { db, unwrap, type Channel, type Goal } from "@/lib/db";
import { addChannel, addGoal, deleteChannel, deleteGoal, refreshFeed } from "./actions";

export const maxDuration = 300;

const input = "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-400";

async function SettingsPageContent(props: PageProps<"/ayarlar">) {
  const { ok, hata } = await props.searchParams;
  const [goals, channels] = await Promise.all([
    db().from("goals").select("id, name, description").order("created_at").then(unwrap) as Promise<Goal[]>,
    db().from("channels").select("*").order("title").then(unwrap) as Promise<Channel[]>,
  ]);

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-6 py-8">
      {ok && <p className="rounded-md border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">{ok}</p>}
      {hata && <p className="rounded-md border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">{hata}</p>}

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Hedefler</h2>
          <p className="text-sm text-zinc-400">
            Akış bu hedeflere göre şekillenir. Açıklama ne kadar net olursa ön eleme o kadar isabetli olur.
          </p>
        </div>
        <ul className="grid gap-2">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-start justify-between gap-4 rounded-md border border-zinc-800 px-4 py-3">
              <div>
                <p className="font-medium">{goal.name}</p>
                {goal.description && <p className="text-sm text-zinc-400">{goal.description}</p>}
              </div>
              <form action={deleteGoal}>
                <input type="hidden" name="id" value={goal.id} />
                <SubmitButton variant="ghost">Sil</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addGoal} className="grid gap-2 rounded-md border border-dashed border-zinc-700 p-4">
          <input name="name" placeholder="Hedef adı (ör. Backend mühendisliği)" required className={input} />
          <textarea
            name="description"
            rows={2}
            placeholder="Kısa açıklama (ör. Ölçeklenebilir backend sistemleri tasarlayıp kurabilmek istiyorum.)"
            className={input}
          />
          <div>
            <SubmitButton pendingLabel="Ekleniyor…">Hedef ekle</SubmitButton>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Kaynak kanallar</h2>
          <p className="text-sm text-zinc-400">Bu kanalların son 50 videosu her gün aday havuzuna alınır.</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {channels.map((channel) => (
            <li key={channel.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 px-4 py-2">
              <div className="flex min-w-0 items-center gap-3">
                {channel.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- YouTube images must be shown unmodified
                  <img src={channel.thumbnail_url} alt="" className="size-8 rounded-full" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{channel.title}</p>
                  <p className="truncate text-xs text-zinc-500">{channel.handle}</p>
                </div>
              </div>
              <form action={deleteChannel}>
                <input type="hidden" name="id" value={channel.id} />
                <SubmitButton variant="ghost">Sil</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addChannel} className="flex gap-2">
          <input name="channel" placeholder="Kanal linki veya @handle" required className={input} />
          <SubmitButton pendingLabel="Aranıyor…">Ekle</SubmitButton>
        </form>
      </section>

      <section className="grid gap-3 rounded-md border border-zinc-800 p-4">
        <div>
          <h2 className="text-lg font-semibold">Akışı şimdi yenile</h2>
          <p className="text-sm text-zinc-400">
            Normalde her sabah otomatik yenilenir. Yeni hedef ya da kanal eklediysen hemen görmek için kullan; birkaç dakika sürebilir.
          </p>
        </div>
        <form action={refreshFeed}>
          <SubmitButton pendingLabel="Yenileniyor… (birkaç dakika sürebilir)">Yenile</SubmitButton>
        </form>
      </section>
    </main>
  );
}

export default function SettingsPage(props: PageProps<"/ayarlar">) {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsPageContent {...props} />
    </Suspense>
  );
}
