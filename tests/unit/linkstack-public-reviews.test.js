// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceState = vi.hoisted(() => ({
  getPendingPublicSubmissions: vi.fn(),
  reviewPublicSubmission: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {},
}));

vi.mock("../../src/services/bookmarks.service.js", () => ({
  BookmarksService: class {
    getPendingPublicSubmissions(...args) {
      return serviceState.getPendingPublicSubmissions(...args);
    }

    reviewPublicSubmission(...args) {
      return serviceState.reviewPublicSubmission(...args);
    }
  },
}));

describe("linkstack-public-reviews", () => {
  beforeEach(async () => {
    serviceState.getPendingPublicSubmissions.mockReset();
    serviceState.reviewPublicSubmission.mockReset();
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
    serviceState.getPendingPublicSubmissions.mockResolvedValue([
      {
        id: "listing-1",
        review_kind: "public_listing",
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "A short description",
        tags: ["web", "testing"],
      },
      {
        id: "stack-1",
        review_kind: "public_stack",
        url: "https://example.com/stack",
        page_title: "Frontend stack",
        meta_description: "A short description",
        tags: ["frontend"],
      },
    ]);

    const element = /** @type {HTMLElement & { render: () => Promise<void> }} */ (
      document.querySelector("linkstack-public-reviews")
    );

    await element.render();

    expect(document.querySelector("#public-review-summary")?.textContent).toContain(
      "2 bookmarks waiting for review.",
    );
    expect(document.querySelectorAll(".review-card")).toHaveLength(2);
    expect(document.querySelector(".review-domain")?.textContent).toBe("example.com");
    expect(document.querySelector(".bookmark-title")?.textContent).toBe("Example article");
    expect(document.querySelectorAll(".bookmark-tags .tag")).toHaveLength(3);
  });

  it("requires a rejection reason before rejecting a bookmark", async () => {
    serviceState.reviewPublicSubmission.mockResolvedValue(undefined);
    serviceState.getPendingPublicSubmissions.mockResolvedValue([
      {
        id: "listing-1",
        review_kind: "public_listing",
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

    expect(serviceState.reviewPublicSubmission).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith(
      "Choose a rejection reason before rejecting this bookmark.",
      "warning",
    );
  });

  it("moves focus to the review summary when the panel opens", async () => {
    serviceState.getPendingPublicSubmissions.mockResolvedValue([]);

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

  it("reviews stack submissions through the unified moderation method", async () => {
    serviceState.reviewPublicSubmission.mockResolvedValue(undefined);
    serviceState.getPendingPublicSubmissions.mockResolvedValue([
      {
        id: "stack-1",
        review_kind: "public_stack",
        url: "https://example.com/stack",
        page_title: "Frontend stack",
        meta_description: "A short description",
        tags: [],
      },
    ]);

    const element = /** @type {HTMLElement & { render: () => Promise<void> }} */ (
      document.querySelector("linkstack-public-reviews")
    );

    await element.render();

    document
      .querySelector('[data-review-action="approve"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(serviceState.reviewPublicSubmission).toHaveBeenCalledWith("public_stack", "stack-1", {
        decision: "approve",
        rejectionCode: null,
        rejectionReason: "",
      });
    });
  });
});
