import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "HyperTube",
  description: "Kendini geliştirmeye odaklı kişisel YouTube.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-zinc-800/80">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight text-zinc-100">
              Hyper<span className="text-amber-400">Tube</span>
            </Link>
            <Link href="/" className="text-zinc-400 hover:text-zinc-100">
              Akış
            </Link>
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
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
