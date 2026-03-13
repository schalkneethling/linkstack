// @ts-check
/**
 * Form Drawer Web Component
 * Manages opening/closing the bookmark form popover with keyboard shortcuts
 */
class FormDrawer extends HTMLElement {
  #lastFocusedElement = null;
  #keydownHandler = null;
  #bookmarkCreatedHandler = null;
  #toggleHandler = null;

  connectedCallback() {
    this.#attachEventListeners();
  }

  disconnectedCallback() {
    if (this.#keydownHandler) {
      document.removeEventListener("keydown", this.#keydownHandler);
      this.#keydownHandler = null;
    }

    if (this.#bookmarkCreatedHandler) {
      window.removeEventListener("bookmark-created", this.#bookmarkCreatedHandler);
      this.#bookmarkCreatedHandler = null;
    }

    if (this.#toggleHandler) {
      this.removeEventListener("toggle", this.#toggleHandler);
      this.#toggleHandler = null;
    }
  }

  #attachEventListeners() {
    if (!this.#keydownHandler) {
      this.#keydownHandler = (event) => {
        const target = event.target;
        const isEditableTarget =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement);

        if (isEditableTarget || this.hidden) {
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === "n") {
          event.preventDefault();
          this.open();
        }
      };
      document.addEventListener("keydown", this.#keydownHandler);
    }

    if (!this.#bookmarkCreatedHandler) {
      this.#bookmarkCreatedHandler = () => {
        this.close();
      };
      window.addEventListener("bookmark-created", this.#bookmarkCreatedHandler);
    }

    if (!this.#toggleHandler) {
      this.#toggleHandler = (event) => {
        const toggleEvent = /** @type {ToggleEvent} */ (event);
        if (toggleEvent.newState === "open") {
          const urlInput = this.querySelector("#url");
          if (urlInput instanceof HTMLInputElement) {
            setTimeout(() => {
              urlInput.focus();
            }, 100);
          }
          return;
        }

        if (this.#lastFocusedElement instanceof HTMLElement) {
          this.#lastFocusedElement.focus();
          this.#lastFocusedElement = null;
        }
      };
      this.addEventListener("toggle", this.#toggleHandler);
    }
  }

  /**
   * Open the form drawer
   */
  open() {
    if (this.hidden) {
      return;
    }

    this.#lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.showPopover();
  }

  /**
   * Close the form drawer
   */
  close() {
    this.hidePopover();
  }
}

if (!customElements.get("form-drawer")) {
  customElements.define("form-drawer", FormDrawer);
}

export { FormDrawer };
