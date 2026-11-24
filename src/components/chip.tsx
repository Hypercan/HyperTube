import Link from "next/link";

export function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${active ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
    >
      {children}
    </Link>
  );
}
