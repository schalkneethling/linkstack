// @ts-check
import { CONFIRM_DIALOG_MESSAGES } from "./constants/ui-strings.js";

/**
 * Reusable confirmation dialog that returns a boolean result.
 */
export class LinkStackConfirmDialog extends HTMLElement {
  static #selectors = {
    dialog: "dialog",
    title: "#dialog-confirm-title",
    message: "#dialog-confirm-message",
    confirmButton: "#confirm-dialog-confirm",
    cancelButton: "#confirm-dialog-cancel",
  };

  #elements = {
    /** @type {HTMLDialogElement | null} */
    dialog: null,
    /** @type {HTMLElement | null} */
    title: null,
    /** @type {HTMLElement | null} */
    message: null,
    /** @type {HTMLButtonElement | null} */
    confirmButton: null,
    /** @type {HTMLButtonElement | null} */
    cancelButton: null,
  };

  /** @type {((confirmed: boolean) => void) | null} */
  #resolver = null;
  /** @type {HTMLElement | null} */
  #lastFocusedElement = null;
  #confirmHandler = null;
  #cancelHandler = null;
  #closeHandler = null;

  connectedCallback() {
    this.#initElements();
    this.#attachEventListeners();
  }

  disconnectedCallback() {
    const { dialog, confirmButton, cancelButton } = this.#elements;

    if (confirmButton && this.#confirmHandler) {
      confirmButton.removeEventListener("click", this.#confirmHandler);
    }

    if (cancelButton && this.#cancelHandler) {
      cancelButton.removeEventListener("click", this.#cancelHandler);
    }

    if (dialog && this.#closeHandler) {
      dialog.removeEventListener("close", this.#closeHandler);
    }
  }

  #initElements() {
    this.#elements.dialog = this.querySelector(LinkStackConfirmDialog.#selectors.dialog);
    this.#elements.title = this.querySelector(LinkStackConfirmDialog.#selectors.title);
    this.#elements.message = this.querySelector(LinkStackConfirmDialog.#selectors.message);
    this.#elements.confirmButton = this.querySelector(
      LinkStackConfirmDialog.#selectors.confirmButton,
    );
    this.#elements.cancelButton = this.querySelector(
      LinkStackConfirmDialog.#selectors.cancelButton,
    );
  }

  #attachEventListeners() {
    const { dialog, confirmButton, cancelButton } = this.#elements;

    if (!dialog || !confirmButton || !cancelButton) {
      return;
    }

    if (!this.#confirmHandler) {
      this.#confirmHandler = () => {
        dialog.close("confirm");
      };
      confirmButton.addEventListener("click", this.#confirmHandler);
    }

    if (!this.#cancelHandler) {
      this.#cancelHandler = () => {
        dialog.close("cancel");
      };
      cancelButton.addEventListener("click", this.#cancelHandler);
    }

    if (!this.#closeHandler) {
      this.#closeHandler = () => {
        const wasConfirmed = dialog.returnValue === "confirm";
        this.#resolver?.(wasConfirmed);
        this.#resolver = null;

        if (this.#lastFocusedElement instanceof HTMLElement) {
          this.#lastFocusedElement.focus();
          this.#lastFocusedElement = null;
        }
      };
      dialog.addEventListener("close", this.#closeHandler);
    }
  }

  /**
   * @param {{
   *   title: string,
   *   message: string,
   *   confirmLabel?: string,
   *   cancelLabel?: string,
   * }} options
   * @returns {Promise<boolean>}
   */
  confirm({
    title,
    message,
    confirmLabel = CONFIRM_DIALOG_MESSAGES.confirm,
    cancelLabel = CONFIRM_DIALOG_MESSAGES.cancel,
  }) {
    const { dialog, title: titleEl, message: messageEl, confirmButton, cancelButton } =
      this.#elements;

    if (!dialog || !titleEl || !messageEl || !confirmButton || !cancelButton) {
      return Promise.resolve(false);
    }

    if (this.#resolver) {
      this.#resolver(false);
      this.#resolver = null;
    }

    this.#lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;

    dialog.showModal();
    confirmButton.focus();

    return new Promise((resolve) => {
      this.#resolver = resolve;
    });
  }
}

if (!customElements.get("linkstack-confirm-dialog")) {
  customElements.define("linkstack-confirm-dialog", LinkStackConfirmDialog);
}
