// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceState = vi.hoisted(() => ({
  getPendingPublicListings: vi.fn(),
  reviewPublicShare: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {},
}));

vi.mock("../../src/services/bookmarks.service.js", () => ({
  BookmarksService: class {
    getPendingPublicListings(...args) {
      return serviceState.getPendingPublicListings(...args);
    }

    reviewPublicShare(...args) {
      return serviceState.reviewPublicShare(...args);
    }
  },
}));

describe("linkstack-public-reviews", () => {
  beforeEach(async () => {
    serviceState.getPendingPublicListings.mockReset();
    serviceState.reviewPublicShare.mockReset();
    document.body.innerHTML = `
      <div id="admin-panel">
        <linkstack-public-reviews>
          <p id="public-review-summary"></p>
          <div id="public-review-container"></div>
        </linkstack-public-reviews>
      </div>
      <linkstack-toast></linkstack-toast>
    `;

    const toast = /** @type {HTMLElement & { show?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-toast")
    );
    toast.show = vi.fn();

    await import("../../src/linkstack-public-reviews.js");
  });

  it("renders pending public reviews", async () => {
    serviceState.getPendingPublicListings.mockResolvedValue([
      {
        public_listing_id: "listing-1",
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "A short description",
        tags: ["web", "testing"],
      },
    ]);

    const element = /** @type {HTMLElement & { render: () => Promise<void> }} */ (
      document.querySelector("linkstack-public-reviews")
    );

    await element.render();

    expect(document.querySelector("#public-review-summary")?.textContent).toContain(
      "1 bookmark waiting for review.",
    );
    expect(document.querySelectorAll(".review-card")).toHaveLength(1);
    expect(document.querySelector(".review-domain")?.textContent).toBe("example.com");
    expect(document.querySelector(".bookmark-title")?.textContent).toBe("Example article");
    expect(document.querySelectorAll(".bookmark-tags .tag")).toHaveLength(2);
  });

  it("requires a rejection reason before rejecting a bookmark", async () => {
    serviceState.reviewPublicShare.mockResolvedValue(undefined);
    serviceState.getPendingPublicListings.mockResolvedValue([
      {
        public_listing_id: "listing-1",
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "A short description",
        tags: [],
      },
    ]);

    const element = /** @type {HTMLElement & { render: () => Promise<void> }} */ (
      document.querySelector("linkstack-public-reviews")
    );
    const toast = /** @type {{ show: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-toast"))
    );

    await element.render();

    document
      .querySelector('[data-review-action="reject"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(serviceState.reviewPublicShare).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith(
      "Choose a rejection reason before rejecting this bookmark.",
      "warning",
    );
  });

  it("moves focus to the review summary when the panel opens", async () => {
    serviceState.getPendingPublicListings.mockResolvedValue([]);

    const summary = /** @type {HTMLElement} */ (
      document.querySelector("#public-review-summary")
    );
    const focusSpy = vi.fn();
    summary.focus = focusSpy;

    window.dispatchEvent(
      new CustomEvent("auth-state-changed", {
        detail: { isAdmin: true },
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    window.dispatchEvent(new CustomEvent("public-review-panel-opened"));
    await Promise.resolve();
    await Promise.resolve();

    expect(summary.tabIndex).toBe(-1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
