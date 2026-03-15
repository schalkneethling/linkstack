// @ts-check
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../netlify/functions/get-bookmark-data/get-bookmark-data.js";

describe("get-bookmark-data function", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for an invalid bookmark URL", async () => {
    const request = new Request(
      "http://localhost/.netlify/functions/get-bookmark-data?url=javascript:alert(1)",
      {
        headers: {
          origin: "http://localhost:8888",
        },
      },
    );

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("URL must use http:// or https:// protocol");
  });

  it("returns sanitized metadata for a valid page", async () => {
    const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (fetch);
    fetchMock.mockResolvedValue(
      new Response(
        `
          <html>
            <head>
              <title>Example Article</title>
              <meta name="description" content="Example description" />
            </head>
          </html>
        `,
        { status: 200 },
      ),
    );

    const request = new Request(
      "http://localhost/.netlify/functions/get-bookmark-data?url=https://example.com/article",
      {
        headers: {
          origin: "http://localhost:8888",
        },
      },
    );

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      pageTitle: "Example Article",
      metaDescription: "Example description",
    });
  });

  it("returns 502 when the upstream site responds with a non-ok status", async () => {
    const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (fetch);
    fetchMock.mockResolvedValue(new Response("nope", { status: 403, statusText: "Forbidden" }));

    const request = new Request(
      "http://localhost/.netlify/functions/get-bookmark-data?url=https://example.com/article",
      {
        headers: {
          origin: "http://localhost:8888",
        },
      },
    );

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe(
      "Failed to fetch metadata from the target site: 403 Forbidden",
    );
  });

  it("returns 504 when the upstream fetch times out", async () => {
    const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (fetch);
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    const request = new Request(
      "http://localhost/.netlify/functions/get-bookmark-data?url=https://example.com/article",
      {
        headers: {
          origin: "http://localhost:8888",
        },
      },
    );

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBe("Timed out while fetching metadata from the target site.");
  });
});
