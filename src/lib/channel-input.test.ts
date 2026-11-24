import { describe, expect, it } from "vitest";
import { parseChannelInput } from "./channel-input";

const ID = "UC_x5XG1OV2P6uZZ5FSM9Ttw";

describe("parseChannelInput", () => {
  it.each([
    [ID, { kind: "id", value: ID }],
    ["@lexfridman", { kind: "handle", value: "@lexfridman" }],
    ["lexfridman", { kind: "handle", value: "@lexfridman" }],
    ["https://www.youtube.com/@lexfridman", { kind: "handle", value: "@lexfridman" }],
    ["https://www.youtube.com/@lexfridman/videos", { kind: "handle", value: "@lexfridman" }],
    ["youtube.com/@lexfridman", { kind: "handle", value: "@lexfridman" }],
    [`https://www.youtube.com/channel/${ID}`, { kind: "id", value: ID }],
    ["https://m.youtube.com/user/GoogleDevelopers", { kind: "username", value: "GoogleDevelopers" }],
  ])("%s", (input, expected) => {
    expect(parseChannelInput(input)).toEqual(expected);
  });

  it.each(["", "   ", "https://vimeo.com/foo", "https://www.youtube.com/watch?v=abc", "bad handle!"])("rejects %j", (input) => {
    expect(parseChannelInput(input)).toBeNull();
  });
});
