import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { isValidSession, SESSION_COOKIE } from "./session";

/** Proxy only does an optimistic check; server actions and route handlers re-verify. */
export async function requireSession(): Promise<void> {
  const jar = await cookies();
  if (!(await isValidSession(jar.get(SESSION_COOKIE)?.value, env.appPassword))) redirect("/giris");
}

export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return isValidSession(jar.get(SESSION_COOKIE)?.value, env.appPassword);
}
