// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("linkstack-confirm-dialog", () => {
  beforeEach(async () => {
    document.body.innerHTML = `
      <button type="button" id="trigger">Open</button>
      <linkstack-confirm-dialog>
        <dialog
          aria-labelledby="dialog-confirm-title"
          aria-describedby="dialog-confirm-message"
          class="linkstack-dialog"
          id="dialog-confirm-action"
        >
          <h3 id="dialog-confirm-title">Confirm action</h3>
          <p id="dialog-confirm-message">Are you sure?</p>
          <div class="bookmark-actions">
            <button id="confirm-dialog-cancel" type="button">Cancel</button>
            <button id="confirm-dialog-confirm" type="button">Confirm</button>
          </div>
        </dialog>
      </linkstack-confirm-dialog>
    `;

    await import("../../src/linkstack-confirm-dialog.js");

    const dialog = /** @type {HTMLDialogElement & {
     *   showModal: ReturnType<typeof vi.fn>,
     *   close: (returnValue?: string) => void
     * }} */ (document.querySelector("#dialog-confirm-action"));

    dialog.showModal = vi.fn(() => {
      dialog.setAttribute("open", "");
    });

    dialog.close = (returnValue = "") => {
      dialog.returnValue = returnValue;
      dialog.removeAttribute("open");
      dialog.dispatchEvent(new Event("close"));
    };
  });

  it("resolves true when confirmed and restores focus", async () => {
    const trigger = /** @type {HTMLButtonElement} */ (
      document.querySelector("#trigger")
    );
    const confirmDialog = /** @type {HTMLElement & {
     *   confirm: (options: {
     *     title: string,
     *     message: string,
     *     confirmLabel?: string,
     *     cancelLabel?: string,
     *   }) => Promise<boolean>
     * }} */ (document.querySelector("linkstack-confirm-dialog"));
    const confirmButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#confirm-dialog-confirm")
    );
    const title = document.querySelector("#dialog-confirm-title");
    const message = document.querySelector("#dialog-confirm-message");

    trigger.focus();

    const resultPromise = confirmDialog.confirm({
      title: "Link already public",
      message: "Add it privately instead?",
      confirmLabel: "Add to my bookmarks",
      cancelLabel: "Skip",
    });

    expect(title?.textContent).toBe("Link already public");
    expect(message?.textContent).toBe("Add it privately instead?");
    expect(confirmButton.textContent).toBe("Add to my bookmarks");
    expect(document.activeElement).toBe(confirmButton);

    confirmButton.click();

    await expect(resultPromise).resolves.toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("resolves false when cancelled", async () => {
    const confirmDialog = /** @type {HTMLElement & {
     *   confirm: (options: {
     *     title: string,
     *     message: string,
     *   }) => Promise<boolean>
     * }} */ (document.querySelector("linkstack-confirm-dialog"));
    const cancelButton = /** @type {HTMLButtonElement} */ (
      document.querySelector("#confirm-dialog-cancel")
    );

    const resultPromise = confirmDialog.confirm({
      title: "Link already public",
      message: "Add it privately instead?",
    });

    cancelButton.click();

    await expect(resultPromise).resolves.toBe(false);
  });
});
