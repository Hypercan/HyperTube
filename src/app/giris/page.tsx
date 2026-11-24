import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/session";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, env.appPassword)) redirect("/giris?hata=1");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionToken(env.appPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  redirect("/");
}

async function LoginPageContent(props: PageProps<"/giris">) {
  const { hata } = await props.searchParams;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HyperTube</h1>
        <p className="mt-1 text-sm text-zinc-400">Kendini geliştirmeye odaklı kişisel YouTube.</p>
      </div>
      <form action={login} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Şifre"
          autoFocus
          required
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
        />
        {hata && <p className="text-sm text-red-400">Şifre yanlış.</p>}
        <button className="rounded-md bg-amber-400 px-3 py-2 font-medium text-zinc-950 hover:bg-amber-300">Giriş</button>
      </form>
    </main>
  );
}

export default function LoginPage(props: PageProps<"/giris">) {
  return (
    <Suspense fallback={<Loading />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}
