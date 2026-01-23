/**
 * View Toggle Component
 * Manages grid/list view switching with localStorage persistence
 */
class ViewToggle extends HTMLElement {
  #currentView = "grid";
  #buttons = null;
  #storageKey = "linkstack:view-preference";

  static #selectors = {
    button: ".view-toggle-button",
    bookmarksContainer: "#bookmarks-container",
  };

  connectedCallback() {
    this.#init();
  }

  #init() {
    this.#buttons = this.querySelectorAll(ViewToggle.#selectors.button);
    this.#loadViewPreference();
    this.#attachEventListeners();
    this.#applyView();
  }

  #attachEventListeners() {
    this.#buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.view;
        if (view !== this.#currentView) {
          this.#setView(view);
        }
      });
    });
  }

  #setView(view) {
    this.#currentView = view;
    this.#updateButtons();
    this.#applyView();
    this.#saveViewPreference();
    this.#dispatchViewChange();
  }

  #updateButtons() {
    this.#buttons.forEach((button) => {
      const isActive = button.dataset.view === this.#currentView;
      button.setAttribute("aria-pressed", isActive.toString());
    });
  }

  #applyView() {
    const container = document.querySelector(
      ViewToggle.#selectors.bookmarksContainer,
    );
    if (!container) return;

    // Remove both classes first
    container.classList.remove("view-grid", "view-list");

    // Add the current view class
    container.classList.add(`view-${this.#currentView}`);
  }

  #saveViewPreference() {
    try {
      localStorage.setItem(this.#storageKey, this.#currentView);
    } catch (error) {
      console.warn("Failed to save view preference:", error);
    }
  }

  #loadViewPreference() {
    try {
      const savedView = localStorage.getItem(this.#storageKey);
      if (savedView === "grid" || savedView === "list") {
        this.#currentView = savedView;
      }
    } catch (error) {
      console.warn("Failed to load view preference:", error);
    }
  }

  #dispatchViewChange() {
    const event = new CustomEvent("view-changed", {
      detail: { view: this.#currentView },
      bubbles: true,
    });
    this.dispatchEvent(event);
  }

  /**
   * Get the current view mode
   * @returns {string} Current view ("grid" or "list")
   */
  getCurrentView() {
    return this.#currentView;
  }
}

customElements.define("view-toggle", ViewToggle);

export { ViewToggle };
