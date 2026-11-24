import { describe, expect, it } from "vitest";
import { framesPerSecondFor, MAX_ANALYZABLE_SECONDS, normalizeSyllabus } from "./syllabus";

const estimatedTokens = (seconds: number) => seconds * (70 * framesPerSecondFor(seconds) + 25);

describe("framesPerSecondFor", () => {
  it("keeps full frame rate for short videos", () => {
    expect(framesPerSecondFor(20 * 60)).toBe(1);
  });

  it.each([45 * 60, 60 * 60, 90 * 60, MAX_ANALYZABLE_SECONDS])("keeps a %is video under the 250K/minute free-tier limit", (seconds) => {
    const fps = framesPerSecondFor(seconds);
    expect(fps).toBeGreaterThan(0);
    expect(estimatedTokens(seconds)).toBeLessThanOrEqual(200_000);
  });
});

describe("normalizeSyllabus", () => {
  it("sorts chapters and drops timestamps outside the video", () => {
    const result = normalizeSyllabus(
      {
        mainIdea: "x",
        audience: "y",
        prerequisites: [],
        keyTakeaways: ["a", "b", "c"],
        chapters: [
          { startSeconds: 600, title: " İkinci " },
          { startSeconds: 0, title: "Giriş" },
          { startSeconds: 9999, title: "Hayali" },
        ],
      },
      1200,
    );
    expect(result.chapters).toEqual([
      { startSeconds: 0, title: "Giriş" },
      { startSeconds: 600, title: "İkinci" },
    ]);
  });
});
