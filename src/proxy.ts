import { NextResponse, type NextRequest } from "next/server";
import { isPublicRequest } from "@/lib/access";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  if (isPublicRequest(request.nextUrl.pathname, request.method)) return NextResponse.next();
  const ok = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value, process.env.APP_PASSWORD);
  if (ok) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  const login = new URL("/giris", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!giris|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
