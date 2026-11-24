import { env } from "@/lib/env";
import { runDailyPipeline } from "@/lib/pipeline";
import { safeEqual } from "@/lib/session";

export const maxDuration = 300;

/** Called once a day by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env.cronSecret}`)) return Response.json({ error: "Yetkisiz" }, { status: 401 });

  const report = await runDailyPipeline();
  return Response.json(report);
}
