import { describe, expect, it } from "vitest";
import { isPublicRequest } from "./access";

describe("isPublicRequest", () => {
  it("opens the Akış and video pages to visitors", () => {
    expect(isPublicRequest("/", "GET")).toBe(true);
    expect(isPublicRequest("/video/CKAZu63z0xI", "GET")).toBe(true);
  });

  it("lets visitors read a syllabus but not start one", () => {
    expect(isPublicRequest("/api/syllabus/CKAZu63z0xI", "GET")).toBe(true);
    expect(isPublicRequest("/api/syllabus/CKAZu63z0xI", "POST")).toBe(false);
  });

  it("keeps settings, search and everything else behind the password", () => {
    expect(isPublicRequest("/ayarlar", "GET")).toBe(false);
    expect(isPublicRequest("/ara", "GET")).toBe(false);
    expect(isPublicRequest("/videos", "GET")).toBe(false);
  });
});
