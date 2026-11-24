export type Syllabus = {
  mainIdea: string;
  audience: string;
  prerequisites: string[];
  chapters: { startSeconds: number; title: string }[];
  keyTakeaways: string[];
};

export const SYLLABUS_SCHEMA = {
  type: "object",
  properties: {
    mainIdea: { type: "string", description: "Videonun ana fikri, 2-3 cümle." },
    audience: { type: "string", description: "Video kime hitap ediyor, hangi seviyede; 1 cümle." },
    prerequisites: {
      type: "array",
      items: { type: "string" },
      description: "İzlemeden önce bilinmesi gerekenler; yoksa boş dizi.",
    },
    chapters: {
      type: "array",
      description: "Videonun kronolojik bölümleri; her bölümün başladığı saniye ve kısa başlığı.",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "integer", minimum: 0 },
          title: { type: "string" },
        },
        required: ["startSeconds", "title"],
      },
    },
    keyTakeaways: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
      description: "İzleyicinin akılda tutması gereken 3-5 anahtar çıkarım.",
    },
  },
  required: ["mainIdea", "audience", "prerequisites", "chapters", "keyTakeaways"],
} as const;

export function normalizeSyllabus(raw: Syllabus, durationSeconds: number): Syllabus {
  const chapters = raw.chapters
    .filter((c) => Number.isFinite(c.startSeconds) && c.startSeconds >= 0 && c.startSeconds < durationSeconds)
    .map((c) => ({ startSeconds: Math.floor(c.startSeconds), title: c.title.trim() }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  return { ...raw, chapters };
}

const TOKENS_PER_FRAME = 70;
const AUDIO_TOKENS_PER_SECOND = 25;
/** The free tier allows 250K tokens per minute, and one video is sent in a single request. */
const REQUEST_TOKEN_BUDGET = 200_000;

/** Past this, even the audio plus a frame every ~25 s no longer fits the request budget. */
export const MAX_ANALYZABLE_SECONDS = 2 * 60 * 60;

/** Samples fewer frames from longer videos so every request stays inside the token budget. */
export function framesPerSecondFor(durationSeconds: number): number {
  const fps = (REQUEST_TOKEN_BUDGET / Math.max(durationSeconds, 1) - AUDIO_TOKENS_PER_SECOND) / TOKENS_PER_FRAME;
  return Math.min(1, Math.floor(fps * 1000) / 1000);
}
