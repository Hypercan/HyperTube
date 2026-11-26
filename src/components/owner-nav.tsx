import Link from "next/link";
import { hasSession } from "@/lib/auth";

export async function OwnerNav() {
  if (!(await hasSession())) {
    return (
      <Link href="/giris" className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">
        Giriş
      </Link>
    );
  }

  return (
    <>
      <Link href="/ayarlar" className="text-zinc-400 hover:text-zinc-100">
        Hedefler & Kanallar
      </Link>
      <form action="/ara" className="ml-auto w-full max-w-xs">
        <input
          type="search"
          name="q"
          placeholder="Ara…"
          aria-label="YouTube'da ara"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
      </form>
    </>
  );
}
