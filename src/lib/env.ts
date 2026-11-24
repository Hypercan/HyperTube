import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Eksik ortam değişkeni: ${name} (bkz. .env.example)`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get youtubeApiKey() {
    return required("YOUTUBE_API_KEY");
  },
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get screeningModel() {
    return process.env.GEMINI_SCREENING_MODEL || "gemini-flash-lite-latest";
  },
  get syllabusModel() {
    return process.env.GEMINI_SYLLABUS_MODEL || "gemini-flash-latest";
  },
  get appPassword() {
    return required("APP_PASSWORD");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get dailyDeepAnalysisSeconds() {
    return Number(process.env.DAILY_DEEP_ANALYSIS_MINUTES || 360) * 60;
  },
};
