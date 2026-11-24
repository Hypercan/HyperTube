export const SESSION_COOKIE = "hypertube_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** The session token is derived from the password, so changing APP_PASSWORD logs every browser out. */
export async function sessionToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("hypertube-session-v1"));
  return Buffer.from(signature).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined, password: string | undefined): Promise<boolean> {
  if (!cookieValue || !password) return false;
  return safeEqual(cookieValue, await sessionToken(password));
}
