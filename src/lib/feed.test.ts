import { describe, expect, it } from "vitest";
import { buildFeed, type ScreenedCandidate } from "./feed";

const LONG = 30 * 60;
const MID = 10 * 60;

function candidate(videoId: string, goalId: string | null, score: number, durationSeconds = LONG): ScreenedCandidate {
  return { videoId, goalId, score, durationSeconds };
}

const options = { perBucket: 3, minPerGoal: 1, minScore: 50 };

describe("buildFeed", () => {
  it("drops irrelevant, low-score, short and unknown-goal candidates", () => {
    const feed = buildFeed(
      [
        candidate("ok", "a", 80),
        candidate("no-goal", null, 99),
        candidate("low", "a", 40),
        candidate("short", "a", 90, 120),
        candidate("deleted-goal", "zzz", 90),
      ],
      ["a"],
      new Set(),
      options,
    );
    expect(feed.map((e) => e.videoId)).toEqual(["ok"]);
  });

  it("guarantees each goal its minimum slots before filling by score", () => {
    const feed = buildFeed(
      [candidate("a1", "a", 95), candidate("a2", "a", 94), candidate("a3", "a", 93), candidate("b1", "b", 60)],
      ["a", "b"],
      new Set(),
      options,
    );
    expect(feed.map((e) => e.videoId)).toEqual(["a1", "a2", "b1"]);
  });

  it("fills longform and mid-length buckets separately", () => {
    const feed = buildFeed(
      [
        candidate("l1", "a", 90),
        candidate("l2", "a", 89),
        candidate("l3", "a", 88),
        candidate("l4", "a", 87),
        candidate("m1", "a", 70, MID),
      ],
      ["a"],
      new Set(),
      options,
    );
    expect(feed.map((e) => e.videoId)).toEqual(["l1", "l2", "l3", "m1"]);
  });

  it("prefers videos not shown recently, falling back to them when the pool is thin", () => {
    const feed = buildFeed(
      [candidate("seen", "a", 99), candidate("new1", "a", 70), candidate("new2", "a", 60)],
      ["a"],
      new Set(["seen"]),
      { ...options, perBucket: 2 },
    );
    expect(feed.map((e) => e.videoId)).toEqual(["new1", "new2"]);

    const thin = buildFeed([candidate("seen", "a", 99), candidate("new1", "a", 70)], ["a"], new Set(["seen"]), options);
    expect(thin.map((e) => e.videoId)).toEqual(["seen", "new1"]);
  });

  it("ranks the final list by score", () => {
    const feed = buildFeed([candidate("m", "a", 99, MID), candidate("l", "a", 60)], ["a"], new Set(), options);
    expect(feed).toEqual([
      { videoId: "m", goalId: "a", rank: 1 },
      { videoId: "l", goalId: "a", rank: 2 },
    ]);
  });
});
