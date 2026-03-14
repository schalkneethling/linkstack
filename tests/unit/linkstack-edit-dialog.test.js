// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceState = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {},
}));

vi.mock("../../src/services/bookmarks.service.js", () => ({
  BookmarksService: class {
    getById(...args) {
      return serviceState.getById(...args);
    }

    update(...args) {
      return serviceState.update(...args);
    }
  },
}));

describe("linkstack-edit-dialog", () => {
  beforeEach(async () => {
    serviceState.getById.mockReset();
    serviceState.update.mockReset();
    document.body.innerHTML = `
      <button id="edit-trigger" type="button">Edit</button>
      <linkstack-edit-dialog>
        <dialog id="dialog-edit-bookmark">
          <form id="edit-bookmark-form">
            <input type="text" name="title" id="edit-title" />
            <textarea name="description" id="edit-description"></textarea>
            <textarea name="notes" id="edit-notes"></textarea>
            <input type="text" name="tags" id="edit-tags" />
            <input type="hidden" name="id" id="edit-id" />
            <button id="dialog-close" type="button">Cancel</button>
            <button id="save-changes-button" type="submit">
              <span class="button-text">Save Changes</span>
              <span class="button-loading" hidden>Saving...</span>
            </button>
          </form>
        </dialog>
      </linkstack-edit-dialog>
      <linkstack-toast></linkstack-toast>
    `;

    const toast = /** @type {HTMLElement & { show?: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("linkstack-toast")
    );
    toast.show = vi.fn();

    await import("../../src/linkstack-edit-dialog-supabase.js");
  });

  it("moves focus into the dialog and restores it when closed", async () => {
    serviceState.getById.mockResolvedValue({
      id: "bookmark-1",
      page_title: "Example article",
      meta_description: "Example description",
      notes: "Some notes",
      tags: ["web", "testing"],
    });

    const trigger = /** @type {HTMLButtonElement} */ (
      document.querySelector("#edit-trigger")
    );
    const element = /** @type {HTMLElement} */ (
      document.querySelector("linkstack-edit-dialog")
    );
    const dialog = /** @type {HTMLDialogElement & { showModal: ReturnType<typeof vi.fn> }} */ (
      document.querySelector("#dialog-edit-bookmark")
    );
    const titleInput = /** @type {HTMLInputElement} */ (
      document.querySelector("#edit-title")
    );

    const showModalSpy = vi.fn();
    dialog.showModal = /** @type {typeof dialog.showModal} */ (showModalSpy);

    trigger.focus();

    element.dispatchEvent(
      new CustomEvent("edit-bookmark", {
        detail: { id: "bookmark-1" },
      }),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(showModalSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(titleInput);

    dialog.dispatchEvent(new Event("close"));

    expect(document.activeElement).toBe(trigger);
  });
});
