import "server-only";
import { GoogleGenAI, MediaResolution } from "@google/genai";
import type { Goal } from "./db";
import { env } from "./env";
import { normalizeSyllabus, SYLLABUS_SCHEMA, type Syllabus } from "./syllabus";

let client: GoogleGenAI | undefined;
function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
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
export async function screenCandidates(goals: Goal[], videos: ScreeningInput[]): Promise<ScreeningResult[]> {
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

  const response = await ai().models.generateContent({
    model: env.screeningModel,
    contents: prompt,
    config: { responseMimeType: "application/json", responseJsonSchema: SCREENING_SCHEMA, temperature: 0.2 },
  });

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

/** Derin analiz: Gemini watches the public video itself instead of a transcript (ADR-0004). */
export async function generateSyllabus(video: { id: string; title: string; durationSeconds: number }): Promise<Syllabus> {
  const prompt = `Bu YouTube videosunu ("${video.title}") baştan sona incele ve kendini geliştirmek isteyen bir izleyici için bir syllabus hazırla.
Konuşmayı ve ekranda gösterilen slayt, kod, diyagram gibi görselleri birlikte değerlendir.
Bölümler videonun gerçek akışını yansıtsın; zaman damgaları videodaki gerçek başlangıç anları olsun.
Video hangi dilde olursa olsun her şeyi Türkçe yaz.`;

  const response = await ai().models.generateContent({
    model: env.syllabusModel,
    contents: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${video.id}` } }, { text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: SYLLABUS_SCHEMA,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    },
  });

  return normalizeSyllabus(JSON.parse(response.text ?? "{}") as Syllabus, video.durationSeconds);
}
