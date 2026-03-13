// @ts-check
import { supabase } from "./lib/supabase.js";
import { AuthService } from "./services/auth.service.js";
import { APP_EVENTS } from "./constants/app-events.js";
import { BOOKMARK_SCOPE } from "./constants/bookmark-ui-state.js";

import "./linkstack-auth.js";
import "./linkstack-bookmarks-supabase.js";

const SCOPE_OPTIONS = Object.freeze({
  guest: Object.freeze([
    { value: BOOKMARK_SCOPE.public, label: "Public bookmarks" },
  ]),
  authenticated: Object.freeze([
    { value: BOOKMARK_SCOPE.mine, label: "My bookmarks" },
    { value: BOOKMARK_SCOPE.all, label: "All bookmarks" },
  ]),
});

class LinkStackApp {
  #authService = new AuthService(supabase);
  #authComponent = null;
  #newBookmarkButton = null;
  #formDrawer = null;
  #scopeSelect = null;
  #scopeLabel = null;
  #adminButton = null;
  #adminPanel = null;
  #currentUser = null;
  #isAdmin = false;
  #authComponentsLoaded = false;

  constructor() {
    this.#init();
  }

  async #init() {
    this.#setupElements();
    this.#setupAuthListeners();
    this.#setupAdminToggle();
    await this.#loadGuestShell();
    await this.#checkAuthState();
  }

  #setupElements() {
    this.#authComponent = document.querySelector("linkstack-auth");
    this.#newBookmarkButton = document.getElementById("new-bookmark-btn");
    this.#formDrawer = document.getElementById("form-drawer");
    this.#scopeSelect = document.getElementById("scope-select");
    this.#scopeLabel = document.getElementById("scope-label");
    this.#adminButton = document.getElementById("admin-review-toggle");
    this.#adminPanel = document.getElementById("admin-panel");
  }

  async #loadGuestShell() {
    this.#updateScopeOptions(false);
    await this.#emitAuthStateChanged();
  }

  async #loadAuthenticatedComponents() {
    if (this.#authComponentsLoaded) {
      return;
    }

    await Promise.all([
      import("./linkstack-form-supabase.js"),
      import("./linkstack-edit-dialog-supabase.js"),
      import("./form-drawer.js"),
      import("./linkstack-public-reviews.js"),
    ]);

    this.#authComponentsLoaded = true;
  }

  #setupAuthListeners() {
    this.#authComponent?.addEventListener("sign-in-google", async () => {
      try {
        await this.#authService.signInWithGoogle();
      } catch {
        this.#showToast(
          "Failed to sign in with Google. Please try again.",
          "error",
        );
      }
    });

    this.#authComponent?.addEventListener("sign-in-github", async () => {
      try {
        await this.#authService.signInWithGitHub();
      } catch {
        this.#showToast(
          "Failed to sign in with GitHub. Please try again.",
          "error",
        );
      }
    });

    this.#authComponent?.addEventListener("sign-out", async () => {
      try {
        await this.#authService.signOut();
        await this.#handleAuthChange(null, false);
      } catch {
        this.#showToast("Failed to sign out. Please try again.", "error");
      }
    });

    this.#authService.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      const isAdmin = user ? await this.#authService.isAdmin() : false;
      await this.#handleAuthChange(user, isAdmin);
    });

    this.#scopeSelect?.addEventListener("change", async () => {
      this.#scopeSelect.value = this.#sanitizeScopeValue(
        this.#scopeSelect.value,
        Boolean(this.#currentUser),
      );
      await this.#emitAuthStateChanged();
    });
  }

  #setupAdminToggle() {
    this.#adminButton?.addEventListener("click", () => {
      const isHidden = Boolean(this.#adminPanel?.hidden);

      this.#setElementHidden(this.#adminPanel, !isHidden);
      this.#adminButton?.setAttribute("aria-pressed", String(isHidden));

      if (isHidden) {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.publicReviewPanelOpened));
      } else {
        this.#adminButton?.focus();
      }
    });
  }

  async #checkAuthState() {
    try {
      const user = await this.#authService.getCurrentUser();
      const isAdmin = user ? await this.#authService.isAdmin() : false;
      await this.#handleAuthChange(user, isAdmin);
    } catch {
      await this.#handleAuthChange(null, false);
    }
  }

  #updateScopeOptions(isAuthenticated) {
    if (!this.#scopeSelect || !this.#scopeLabel) {
      return;
    }

    if (isAuthenticated) {
      this.#scopeLabel.textContent = "Library:";
      this.#replaceScopeOptions(SCOPE_OPTIONS.authenticated);
      this.#scopeSelect.value = this.#sanitizeScopeValue(
        this.#scopeSelect.value,
        true,
      );
    } else {
      this.#scopeLabel.textContent = "Showing:";
      this.#replaceScopeOptions(SCOPE_OPTIONS.guest);
      this.#scopeSelect.value = BOOKMARK_SCOPE.public;
    }
  }

  async #handleAuthChange(user, isAdmin) {
    this.#currentUser = user;
    this.#isAdmin = isAdmin;

    if (user) {
      await this.#loadAuthenticatedComponents();
    }

    this.#authComponent?.setUser(user, { isAdmin });
    this.#setElementHidden(this.#newBookmarkButton, !user);
    this.#setElementHidden(this.#formDrawer, !user);
    this.#setElementHidden(this.#adminButton, !(user && isAdmin));
    this.#adminButton?.setAttribute("aria-pressed", "false");
    this.#setElementHidden(this.#adminPanel, true);

    this.#updateScopeOptions(Boolean(user));
    await this.#emitAuthStateChanged();
  }

  async #emitAuthStateChanged() {
    window.dispatchEvent(
      new CustomEvent(APP_EVENTS.authStateChanged, {
        detail: {
          user: this.#currentUser,
          isAuthenticated: Boolean(this.#currentUser),
          isAdmin: this.#isAdmin,
          scope:
            this.#scopeSelect?.value ||
            this.#sanitizeScopeValue("", Boolean(this.#currentUser)),
        },
      }),
    );
  }

  #replaceScopeOptions(options) {
    if (!this.#scopeSelect) {
      return;
    }

    const fragment = document.createDocumentFragment();
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      fragment.append(optionElement);
    });
    this.#scopeSelect.replaceChildren(fragment);
  }

  /**
   * @param {string} value
   * @param {boolean} isAuthenticated
   * @returns {string}
   */
  #sanitizeScopeValue(value, isAuthenticated) {
    const allowedScopes = /** @type {string[]} */ (isAuthenticated
      ? SCOPE_OPTIONS.authenticated.map((option) => option.value)
      : SCOPE_OPTIONS.guest.map((option) => option.value));

    return allowedScopes.includes(value)
      ? value
      : isAuthenticated
        ? BOOKMARK_SCOPE.mine
        : BOOKMARK_SCOPE.public;
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }

  #setElementHidden(element, isHidden) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.hidden = isHidden;
    element.classList.toggle("hidden", isHidden);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new LinkStackApp();
  });
} else {
  new LinkStackApp();
}
