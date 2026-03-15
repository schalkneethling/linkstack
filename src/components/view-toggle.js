// @ts-check
import { APP_EVENTS } from "../constants/app-events.js";
import { STORAGE_KEYS } from "../constants/storage-keys.js";
import { VIEW_MODE } from "../constants/bookmark-ui-state.js";

/**
 * View Toggle Component
 * Manages grid/list view switching with localStorage persistence
 */
class ViewToggle extends HTMLElement {
  /** @type {"grid" | "list"} */
  #currentView = VIEW_MODE.grid;
  #buttons = null;

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
    this.#updateButtons();
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
      localStorage.setItem(STORAGE_KEYS.viewPreference, this.#currentView);
    } catch {
      // Ignore storage failures; the selected view still applies for the session.
    }
  }

  #loadViewPreference() {
    try {
      const savedView = localStorage.getItem(STORAGE_KEYS.viewPreference);
      if (savedView === VIEW_MODE.grid || savedView === VIEW_MODE.list) {
        this.#currentView = savedView;
      }
    } catch {
      // Ignore storage failures and keep the default view.
    }
  }

  #dispatchViewChange() {
    const event = new CustomEvent(APP_EVENTS.viewChanged, {
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

if (!customElements.get("view-toggle")) {
  customElements.define("view-toggle", ViewToggle);
}

export { ViewToggle };
