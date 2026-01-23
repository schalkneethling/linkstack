/**
 * Form Drawer Web Component
 * Manages opening/closing the bookmark form popover with keyboard shortcuts
 */
class FormDrawer extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.#attachEventListeners();
  }

  #attachEventListeners() {
    // Keyboard shortcut: Ctrl+N or Cmd+N
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        this.open();
      }
    });

    // Close on successful bookmark creation
    window.addEventListener("bookmark-created", () => {
      this.close();
    });

    // Focus URL input when popover opens
    this.addEventListener("toggle", (e) => {
      if (e.newState === "open") {
        const urlInput = this.querySelector("#url");
        if (urlInput) {
          // Small delay to ensure popover animation has started
          setTimeout(() => {
            urlInput.focus();
          }, 100);
        }
      }
    });
  }

  /**
   * Open the form drawer
   */
  open() {
    this.showPopover();
  }

  /**
   * Close the form drawer
   */
  close() {
    this.hidePopover();
  }
}

customElements.define("form-drawer", FormDrawer);

export { FormDrawer };
