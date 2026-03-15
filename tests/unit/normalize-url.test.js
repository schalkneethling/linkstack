// -check
import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../../src/utils/normalize-url.js";

describe("normalizeUrl", () => {
  it("removes fragments and normalizes host casing", () => {
    expect(normalizeUrl("HTTPS://Example.com/path/#section")).toBe(
      "https://example.com/path",
    );
  });

  it("removes default ports and sorts query params", () => {
    expect(normalizeUrl("https://example.com:443/path/?b=2&a=1")).toBe(
      "https://example.com/path?a=1&b=2",
    );
  });
});
