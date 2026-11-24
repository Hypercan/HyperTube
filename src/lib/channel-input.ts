export type ChannelRef = { kind: "id"; value: string } | { kind: "handle"; value: string } | { kind: "username"; value: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const HANDLE = /^@?[\w.-]{3,30}$/;

export function parseChannelInput(raw: string): ChannelRef | null {
  const input = raw.trim();
  if (!input) return null;
  if (CHANNEL_ID.test(input)) return { kind: "id", value: input };

  const url = toUrl(input);
  if (url) {
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (first?.startsWith("@")) return { kind: "handle", value: decodeURIComponent(first) };
    if (first === "channel" && second && CHANNEL_ID.test(second)) return { kind: "id", value: second };
    if (first === "user" && second) return { kind: "username", value: second };
    return null;
  }

  if (HANDLE.test(input)) return { kind: "handle", value: input.startsWith("@") ? input : `@${input}` };
  return null;
}

function toUrl(input: string): URL | null {
  if (!/youtube\.com/.test(input)) return null;
  try {
    return new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return null;
  }
}
