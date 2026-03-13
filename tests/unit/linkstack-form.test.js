// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceState = vi.hoisted(() => ({
  getTopLevel: vi.fn(),
  inspectUrl: vi.fn(),
  addExistingPublicToLibrary: vi.fn(),
  create: vi.fn(),
  fetchAll: vi.fn(),
}));

const settingsState = vi.hoisted(() => ({
  isLimitEnabled: vi.fn(),
  getUnreadLimit: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {},
}));

vi.mock("../../src/services/bookmarks.service.js", () => ({
  BookmarksService: class {
    getTopLevel(...args) {
      return serviceState.getTopLevel(...args);
    }

    inspectUrl(...args) {
      return serviceState.inspectUrl(...args);
    }

    addExistingPublicToLibrary(...args) {
      return serviceState.addExistingPublicToLibrary(...args);
    }

    create(...args) {
      return serviceState.create(...args);
    }

    fetchAll(...args) {
      return serviceState.fetchAll(...args);
    }
  },
}));

vi.mock("../../src/services/settings.service.js", () => ({
  SettingsService: class {
    isLimitEnabled(...args) {
      return settingsState.isLimitEnabled(...args);
    }

    getUnreadLimit(...args) {
      return settingsState.getUnreadLimit(...args);
    }
  },
}));

describe("linkstack-form", () => {
  beforeEach(async () => {
    serviceState.getTopLevel.mockReset();
    serviceState.inspectUrl.mockReset();
    serviceState.addExistingPublicToLibrary.mockReset();
    serviceState.create.mockReset();
    serviceState.fetchAll.mockReset();
    settingsState.isLimitEnabled.mockReset();
    settingsState.getUnreadLimit.mockReset();

    serviceState.getTopLevel.mockResolvedValue([]);
    settingsState.isLimitEnabled.mockReturnValue(false);
    settingsState.getUnreadLimit.mockReturnValue(3);

    document.body.innerHTML = `
      <form-drawer id="form-drawer"></form-drawer>
      <linkstack-form>
        <form id="bookmark-form">
          <input type="url" id="url" name="url" />
          <div id="url-error" hidden></div>
          <select id="parent-bookmark" name="parent_id">
            <option value="">Add to stack (optional)</option>
          </select>
          <input type="checkbox" id="request-public" name="request_public" />
          <p id="request-public-help"></p>
          <textarea id="notes" name="notes"></textarea>
          <button id="submit-bookmark" type="submit">
            <span class="button-text">Add Bookmark</span>
            <span class="button-loading" hidden>Adding...</span>
          </button>
        </form>
      </linkstack-form>
      <linkstack-confirm-dialog></linkstack-confirm-dialog>
      <linkstack-toast></linkstack-toast>
    `;

    const formDrawer = /** @type {HTMLElement & { hidePopover?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("#form-drawer")
    );
    formDrawer.hidePopover = /** @type {typeof formDrawer.hidePopover} */ (vi.fn());

    const confirmDialog = /** @type {HTMLElement & { confirm?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-confirm-dialog")
    );
    confirmDialog.confirm = /** @type {typeof confirmDialog.confirm} */ (vi.fn());

    const toast = /** @type {HTMLElement & { show?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-toast")
    );
    toast.show = /** @type {typeof toast.show} */ (vi.fn());

    await import("../../src/linkstack-form-supabase.js");
  });

  it("uses the confirmation dialog before adding an existing public bookmark privately", async () => {
    serviceState.inspectUrl.mockResolvedValue({
      resource: { id: "resource-1" },
      personal_duplicate: null,
      public_duplicate: { id: "listing-1" },
    });
    serviceState.addExistingPublicToLibrary.mockResolvedValue({ id: "bookmark-1" });

    const confirmDialog = /** @type {{ confirm: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-confirm-dialog"))
    );
    confirmDialog.confirm.mockResolvedValue(true);

    const toast = /** @type {{ show: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-toast"))
    );
    const form = /** @type {HTMLFormElement} */ (document.querySelector("#bookmark-form"));
    const urlInput = /** @type {HTMLInputElement} */ (document.querySelector("#url"));

    urlInput.value = "https://example.com/article";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(serviceState.addExistingPublicToLibrary).toHaveBeenCalledWith({
        resourceId: "resource-1",
        publicListingId: "listing-1",
        notes: "",
        parentId: null,
      });
    });

    expect(confirmDialog.confirm).toHaveBeenCalledWith({
      title: "Link already public",
      message: "This link is already public. Add it to your private bookmarks instead?",
      confirmLabel: "Add to my bookmarks",
      cancelLabel: "Skip",
    });
    expect(toast.show).toHaveBeenCalledWith(
      "Bookmark added to your private bookmarks.",
      "success",
    );
  });

  it("does not add the bookmark when the confirmation dialog is declined", async () => {
    serviceState.inspectUrl.mockResolvedValue({
      resource: { id: "resource-1" },
      personal_duplicate: null,
      public_duplicate: { id: "listing-1" },
    });

    const confirmDialog = /** @type {{ confirm: ReturnType<typeof vi.fn> }} */ (
      /** @type {unknown} */ (document.querySelector("linkstack-confirm-dialog"))
    );
    confirmDialog.confirm.mockResolvedValue(false);

    const form = /** @type {HTMLFormElement} */ (document.querySelector("#bookmark-form"));
    const urlInput = /** @type {HTMLInputElement} */ (document.querySelector("#url"));

    urlInput.value = "https://example.com/article";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(confirmDialog.confirm).toHaveBeenCalledTimes(1);
    });

    expect(serviceState.addExistingPublicToLibrary).not.toHaveBeenCalled();
  });
});
