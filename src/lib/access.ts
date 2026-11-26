/** Visitors may read the Akış and existing syllabi, but nothing that spends Gemini or YouTube quota (ADR-0006). */
export function isPublicRequest(pathname: string, method: string): boolean {
  if (pathname === "/" || pathname.startsWith("/video/")) return true;
  return method === "GET" && pathname.startsWith("/api/syllabus/");
}
