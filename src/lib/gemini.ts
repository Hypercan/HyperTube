import "server-only";
import { ApiError, GoogleGenAI, MediaResolution, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { Goal } from "./db";
import { env } from "./env";
import { framesPerSecondFor, normalizeSyllabus, SYLLABUS_SCHEMA, type Syllabus } from "./syllabus";

let client: GoogleGenAI | undefined;

/** Short waits only: a serverless run has minutes, so an overloaded model is skipped rather than waited out. */
const RETRY_DELAYS_MS = [4_000, 0];

const SCREENING_FALLBACKS = ["gemini-2.5-flash-lite", "gemini-3.8-flash"];
const SYLLABUS_FALLBACKS = ["gemini-3.8-flash", "gemini-2.5-flash"];

function client_(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

export type CallOptions = { deadline?: number; timeoutMs?: number };

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isTimeout(error: unknown): boolean {
  return error instanceof DeadlineReached || (error instanceof Error && (error.name === "AbortError" || /timed? ?out|aborted/i.test(error.message)));
}

/** Google's 503 / UNAVAILABLE / high-demand responses should be retried or switched to another model. */
export function isGeminiTransient(error: unknown): boolean {
  if (isTimeout(error)) return true;
  if (error instanceof ApiError) {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return /503|429|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|overloaded|try again later/i.test(errorText(error));
}

export function geminiErrorDetail(error: unknown): string {
  const raw = errorText(error);
  return raw.length > 1000 ? `${raw.slice(0, 1000)}…` : raw;
}

/** User-facing Turkish copy for settings / API responses. */
export function friendlyGeminiError(error: unknown): string {
  if (isTimeout(error)) return "Gemini zamanında yanıt vermedi. Birkaç dakika sonra tekrar dene.";
  if (isGeminiTransient(error)) {
    return "Gemini şu an yoğun ya da kota doldu (geçici). Birkaç dakika sonra tekrar dene.";
  }
  const raw = errorText(error);
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } };
    if (json.error?.message) return `Gemini: ${json.error.message}`;
  } catch {
    /* not JSON */
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

function modelChain(primary: string, envList: string | undefined, defaults: string[]): string[] {
  const extra = envList?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return [...new Set([primary, ...extra, ...defaults])];
}

class DeadlineReached extends Error {
  constructor() {
    super("Süre doldu");
  }
}

function remaining(options: CallOptions): number {
  return options.deadline ? options.deadline - Date.now() : Infinity;
}

async function generate(params: GenerateContentParameters, options: CallOptions): Promise<GenerateContentResponse> {
  for (const delayMs of RETRY_DELAYS_MS) {
    const left = remaining(options);
    if (left < 5_000) throw new DeadlineReached();
    const timeout = Math.min(options.timeoutMs ?? 90_000, left);
    const httpOptions = Number.isFinite(timeout) ? { timeout } : undefined;
    try {
      return await client_().models.generateContent({ ...params, config: { ...params.config, httpOptions } });
    } catch (error) {
      if (isTimeout(error) || !isGeminiTransient(error) || delayMs === 0 || remaining(options) < delayMs + 5_000) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("unreachable");
}

async function generateFirstAvailable(
  build: (model: string) => GenerateContentParameters,
  models: string[],
  options: CallOptions,
): Promise<GenerateContentResponse> {
  let last: unknown;
  for (const model of models) {
    try {
      return await generate(build(model), options);
    } catch (error) {
      last = error;
      if (error instanceof DeadlineReached || !isGeminiTransient(error)) throw error;
    }
  }
  throw last ?? new Error("Gemini yanıt vermedi");
}

export type ScreeningInput = { id: string; title: string; channelTitle: string; description: string };
export type ScreeningResult = { videoId: string; goalId: string | null; score: number; reason: string };

const SCREENING_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      video: { type: "integer", description: "Videonun listedeki numarası." },
      goal: { type: "integer", description: "En çok hizmet ettiği hedefin numarası; hiçbirine uymuyorsa -1." },
      score: { type: "integer", minimum: 0, maximum: 100 },
      reason: { type: "string", description: "Neden bu puan: tek, kısa Türkçe cümle." },
    },
    required: ["video", "goal", "score", "reason"],
  },
} as const;

/** Ön eleme: scores candidates from text alone. Popularity data is deliberately never sent (ADR-0001). */
export async function screenCandidates(goals: Goal[], videos: ScreeningInput[], options: CallOptions = {}): Promise<ScreeningResult[]> {
  const goalList = goals.map((g, i) => `${i}. ${g.name}${g.description ? `: ${g.description}` : ""}`).join("\n");
  const videoList = videos
    .map((v, i) => `[${i}] ${v.title}\nKanal: ${v.channelTitle}\nAçıklama: ${v.description.slice(0, 700).replace(/\s+/g, " ")}`)
    .join("\n\n");

  const prompt = `Kendini geliştirmeye odaklı bir kullanıcının YouTube videolarını ön elemeden geçiriyorsun.

Kullanıcının hedefleri:
${goalList}

Her video için: hangi hedefe en çok hizmet ettiğini seç ve 0-100 arası puan ver.
Yüksek puan: hedefe doğrudan hizmet eden, derinlemesine, öğretici, kalıcı değeri olan içerik (ders, konferans konuşması, uzman röportajı, kapsamlı anlatım).
Düşük puan: clickbait, drama, haber/gündem, tepki videoları, reklam, motivasyon kırıntısı, yüzeysel listeler, hedeflerle ilgisiz içerik.
Video hangi dilde olursa olsun değerlendir; gerekçeyi Türkçe yaz.

Videolar:
${videoList}`;

  const models = modelChain(env.screeningModel, process.env.GEMINI_SCREENING_MODEL_FALLBACKS, SCREENING_FALLBACKS);
  const response = await generateFirstAvailable(
    (model) => ({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", responseJsonSchema: SCREENING_SCHEMA, temperature: 0.2 },
    }),
    models,
    { timeoutMs: 60_000, ...options },
  );

  const parsed = JSON.parse(response.text ?? "[]") as { video: number; goal: number; score: number; reason: string }[];
  return parsed
    .filter((r) => videos[r.video])
    .map((r) => ({
      videoId: videos[r.video].id,
      goalId: goals[r.goal]?.id ?? null,
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      reason: r.reason,
    }));
}

const DISCOVERY_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      goal: { type: "integer", description: "Hedefin listedeki numarası." },
      queries: { type: "array", items: { type: "string" } },
    },
    required: ["goal", "queries"],
  },
} as const;

/** Keşif araması: YouTube search queries per Hedef, steered away from the ones used last time. */
export async function generateDiscoveryQueries(
  goals: (Goal & { discovery_queries: string[] })[],
  perGoal: number,
  options: CallOptions = {},
): Promise<Map<string, string[]>> {
  const goalList = goals
    .map((g, i) => {
      const previous = g.discovery_queries.length ? `\n   Son kullanılan sorgular (tekrarlama): ${g.discovery_queries.join(" | ")}` : "";
      return `${i}. ${g.name}${g.description ? `: ${g.description}` : ""}${previous}`;
    })
    .join("\n");

  const prompt = `Kendini geliştirmeye odaklı bir kullanıcı için YouTube'da derinlemesine, öğretici, uzun videolar bulacak arama sorguları yazıyorsun.

Hedefler:
${goalList}

Her hedef için ${perGoal} farklı YouTube arama sorgusu yaz.
- Sorgular hedefin farklı alt konularına ve seviyelerine yayılsın; ders, konferans konuşması, uzman röportajı, kapsamlı anlatım bulmaya yönelik olsun.
- Clickbait, haber, drama, tepki videosu getirecek sorgulardan kaçın.
- En az biri İngilizce olsun; diğerleri hedefin diline veya içeriğin en iyi bulunacağı dile göre seçilsin.
- Kısa tut (2-6 kelime), YouTube araması gibi yaz.`;

  const models = modelChain(env.screeningModel, process.env.GEMINI_SCREENING_MODEL_FALLBACKS, SCREENING_FALLBACKS);
  const response = await generateFirstAvailable(
    (model) => ({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", responseJsonSchema: DISCOVERY_SCHEMA, temperature: 0.9 },
    }),
    models,
    { timeoutMs: 45_000, ...options },
  );

  const parsed = JSON.parse(response.text ?? "[]") as { goal: number; queries: string[] }[];
  const byGoal = new Map<string, string[]>();
  for (const entry of parsed) {
    const goal = goals[entry.goal];
    if (!goal) continue;
    const queries = entry.queries.map((q) => q.trim()).filter(Boolean).slice(0, perGoal);
    if (queries.length) byGoal.set(goal.id, queries);
  }
  return byGoal;
}

/** Derin analiz: Gemini watches the public video itself instead of a transcript (ADR-0004). */
export async function generateSyllabus(
  video: { id: string; title: string; durationSeconds: number },
  options: CallOptions,
): Promise<{ syllabus: Syllabus; model: string }> {
  const prompt = `Bu YouTube videosunu ("${video.title}") baştan sona incele ve kendini geliştirmek isteyen bir izleyici için bir syllabus hazırla.
Konuşmayı ve ekranda gösterilen slayt, kod, diyagram gibi görselleri birlikte değerlendir.
Bölümler videonun gerçek akışını yansıtsın; zaman damgaları videodaki gerçek başlangıç anları olsun.
Video hangi dilde olursa olsun her şeyi Türkçe yaz.`;

  const models = modelChain(env.syllabusModel, process.env.GEMINI_SYLLABUS_MODEL_FALLBACKS, SYLLABUS_FALLBACKS);
  const response = await generateFirstAvailable(
    (model) => ({
      model,
      contents: [
        {
          fileData: { fileUri: `https://www.youtube.com/watch?v=${video.id}` },
          videoMetadata: { fps: framesPerSecondFor(video.durationSeconds) },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: SYLLABUS_SCHEMA,
        // framesPerSecondFor budgets ~70 tokens per frame, which is the low resolution rate.
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      },
    }),
    models,
    { timeoutMs: Infinity, ...options },
  );

  return {
    syllabus: normalizeSyllabus(JSON.parse(response.text ?? "{}") as Syllabus, video.durationSeconds),
    model: response.modelVersion ?? env.syllabusModel,
  };
}