// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceState = vi.hoisted(() => ({
  getPublicCatalog: vi.fn(),
  getMyBookmarks: vi.fn(),
  delete: vi.fn(),
  toggleReadStatus: vi.fn(),
  savePublicCopy: vi.fn(),
  requestPublicShare: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {},
}));

vi.mock("../../src/services/bookmarks.service.js", () => ({
  PUBLIC_SHARE_STATUS: {
    NOT_REQUESTED: "not_requested",
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  },
  BookmarksService: class {
    getPublicCatalog(...args) {
      return serviceState.getPublicCatalog(...args);
    }

    getMyBookmarks(...args) {
      return serviceState.getMyBookmarks(...args);
    }

    delete(...args) {
      return serviceState.delete(...args);
    }

    toggleReadStatus(...args) {
      return serviceState.toggleReadStatus(...args);
    }

    savePublicCopy(...args) {
      return serviceState.savePublicCopy(...args);
    }

    requestPublicShare(...args) {
      return serviceState.requestPublicShare(...args);
    }
  },
}));

function createBookmarksFixture() {
  document.body.innerHTML = `
    <input id="search-input" />
    <button id="clear-search" hidden></button>
    <p class="search-results-info"></p>
    <select id="sort-select">
      <option value="newest">Newest</option>
    </select>
    <select id="scope-select">
      <option value="public">Public</option>
      <option value="all">All</option>
    </select>
    <div class="filter-controls-container"></div>
    <linkstack-confirm-dialog></linkstack-confirm-dialog>
    <linkstack-toast></linkstack-toast>
    <linkstack-bookmarks>
      <section id="bookmarks-container"></section>
      <template id="bookmarks-entry-tmpl">
        <li class="bookmark-entry">
          <div class="bookmark-info">
            <a class="bookmark-link" href="">
              <h3 class="bookmark-title"></h3>
            </a>
            <p class="bookmark-description"></p>
            <div class="bookmark-public-status hidden">
              <span class="tag"></span>
            </div>
            <p class="bookmark-public-message hidden"></p>
            <div class="bookmark-tags"></div>
            <div class="bookmark-notes hidden">
              <p class="notes-content"></p>
            </div>
            <div class="bookmark-actions">
              <div class="bookmark-actions-primary">
                <button id="toggle-read-status" type="button">
                  <span class="read-text"></span>
                </button>
                <button id="save-public-copy" type="button" class="hidden">
                  Save to My Bookmarks
                </button>
              </div>
              <button type="button" class="context-menu-trigger" aria-haspopup="true"></button>
              <div class="context-menu" popover>
                <button id="edit-bookmark" type="button"></button>
                <button id="request-public-share" type="button"></button>
                <button id="delete-bookmark" type="button"></button>
              </div>
            </div>
            <button class="stack-toggle hidden" type="button">
              <span class="stack-label">Show stack</span>
            </button>
            <ul class="stack-children reset-list hidden"></ul>
          </div>
        </li>
      </template>
      <template id="bookmark-child-tmpl">
        <li class="bookmark-child">
          <a class="bookmark-link" href="">
            <h4 class="bookmark-title"></h4>
          </a>
          <p class="bookmark-description"></p>
          <div class="bookmark-public-status hidden">
            <span class="tag"></span>
          </div>
          <p class="bookmark-public-message hidden"></p>
          <div class="bookmark-tags"></div>
          <div class="bookmark-notes hidden">
            <p class="notes-content"></p>
          </div>
          <div class="bookmark-actions">
            <div class="bookmark-actions-primary">
              <button id="toggle-read-status" type="button">
                <span class="read-text"></span>
              </button>
              <button id="save-public-copy" type="button" class="hidden">
                Save to My Bookmarks
              </button>
            </div>
            <button type="button" class="context-menu-trigger" aria-haspopup="true"></button>
            <div class="context-menu" popover>
              <button id="edit-bookmark" type="button"></button>
              <button id="request-public-share" type="button"></button>
              <button id="delete-bookmark" type="button"></button>
            </div>
          </div>
        </li>
      </template>
      <template id="no-bookmarks-tmpl">
        <div class="no-bookmarks-wrapper"><p class="text-medium"></p></div>
      </template>
      <template id="skeleton-loader-tmpl">
        <div class="skeleton-loader"></div>
      </template>
    </linkstack-bookmarks>
  `;
}

describe("linkstack-bookmarks", () => {
  beforeEach(async () => {
    serviceState.getPublicCatalog.mockReset();
    serviceState.getMyBookmarks.mockReset();
    serviceState.delete.mockReset();
    serviceState.toggleReadStatus.mockReset();
    serviceState.savePublicCopy.mockReset();
    serviceState.requestPublicShare.mockReset();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    createBookmarksFixture();

    const confirmDialog = /** @type {HTMLElement & { confirm?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-confirm-dialog")
    );
    confirmDialog.confirm = /** @type {typeof confirmDialog.confirm} */ (vi.fn());

    const toast = /** @type {HTMLElement & { show?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-toast")
    );
    toast.show = /** @type {typeof toast.show} */ (vi.fn());

    await import("../../src/linkstack-bookmarks-supabase.js");
  });

  it("hides private actions for guest users viewing public bookmarks", async () => {
    serviceState.getPublicCatalog.mockResolvedValue([
      {
        id: "public-listing-1",
        public_listing_id: "listing-1",
        resource_id: "resource-1",
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "Example description",
        tags: [],
        created_at: "2026-03-07T07:10:00Z",
        updated_at: "2026-03-07T07:10:00Z",
        kind: "public",
        notes: "",
      },
    ]);

    const element = /** @type {HTMLElement & { refresh: () => Promise<void> }} */ (
      document.querySelector("linkstack-bookmarks")
    );

    await element.refresh();

    const readToggle = /** @type {HTMLButtonElement} */ (
      document.querySelector("#toggle-read-status")
    );
    const saveButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#save-public-copy")
    );
    const menuTrigger = /** @type {HTMLButtonElement} */ (
      document.querySelector(".context-menu-trigger")
    );

    expect(readToggle.hidden).toBe(true);
    expect(saveButton.hidden).toBe(true);
    expect(menuTrigger.hidden).toBe(true);
    expect(menuTrigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows save action for authenticated users viewing public bookmarks", async () => {
    serviceState.getPublicCatalog.mockResolvedValue([
      {
        id: "public-listing-1",
        public_listing_id: "listing-1",
        resource_id: "resource-1",
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "Example description",
        tags: [],
        created_at: "2026-03-07T07:10:00Z",
        updated_at: "2026-03-07T07:10:00Z",
        kind: "public",
        notes: "",
      },
    ]);
    serviceState.getMyBookmarks.mockResolvedValue([]);

    const element = /** @type {HTMLElement & { refresh: () => Promise<void> }} */ (
      document.querySelector("linkstack-bookmarks")
    );

    window.dispatchEvent(
      new CustomEvent("auth-state-changed", {
        detail: { isAuthenticated: true, scope: "all" },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    await element.refresh();

    const saveButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#save-public-copy")
    );

    expect(saveButton.hidden).toBe(false);
    expect(saveButton.dataset.publicListingId).toBe("listing-1");
  });

  it("confirms bookmark removal before deleting", async () => {
    serviceState.getMyBookmarks.mockResolvedValue([
      {
        id: "bookmark-1",
        resource_id: "resource-1",
        parent_id: null,
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "Example description",
        tags: [],
        created_at: "2026-03-07T07:10:00Z",
        updated_at: "2026-03-07T07:10:00Z",
        kind: "bookmark",
        notes: "",
        is_read: false,
        public_share_status: "not_requested",
      },
    ]);
    serviceState.delete.mockResolvedValue(undefined);

    const confirmDialog = /** @type {{ confirm: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-confirm-dialog"))
    );
    confirmDialog.confirm.mockResolvedValue(true);

    const toast = /** @type {{ show: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-toast"))
    );

    const element = /** @type {HTMLElement & { refresh: () => Promise<void> }} */ (
      document.querySelector("linkstack-bookmarks")
    );

    window.dispatchEvent(
      new CustomEvent("auth-state-changed", {
        detail: { isAuthenticated: true, scope: "mine" },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    await element.refresh();

    const deleteButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#delete-bookmark")
    );
    deleteButton.dataset.id = "bookmark-1";
    deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(confirmDialog.confirm).toHaveBeenCalledWith({
        title: "Remove bookmark",
        message: "Remove this bookmark from your library?",
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
      });
    });
    await vi.waitFor(() => {
      expect(serviceState.delete).toHaveBeenCalledWith("bookmark-1");
    });
    expect(toast.show).toHaveBeenCalledWith(
      "Bookmark deleted successfully",
      "success",
    );
  });

  it("does not delete a bookmark when removal is cancelled", async () => {
    serviceState.getMyBookmarks.mockResolvedValue([
      {
        id: "bookmark-1",
        resource_id: "resource-1",
        parent_id: null,
        url: "https://example.com/article",
        page_title: "Example article",
        meta_description: "Example description",
        tags: [],
        created_at: "2026-03-07T07:10:00Z",
        updated_at: "2026-03-07T07:10:00Z",
        kind: "bookmark",
        notes: "",
        is_read: false,
        public_share_status: "not_requested",
      },
    ]);

    const confirmDialog = /** @type {{ confirm: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-confirm-dialog"))
    );
    confirmDialog.confirm.mockResolvedValue(false);

    const element = /** @type {HTMLElement & { refresh: () => Promise<void> }} */ (
      document.querySelector("linkstack-bookmarks")
    );

    window.dispatchEvent(
      new CustomEvent("auth-state-changed", {
        detail: { isAuthenticated: true, scope: "mine" },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    await element.refresh();

    const deleteButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#delete-bookmark")
    );
    deleteButton.dataset.id = "bookmark-1";
    deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(confirmDialog.confirm).toHaveBeenCalledTimes(1);
    });
    expect(serviceState.delete).not.toHaveBeenCalled();
  });
});
