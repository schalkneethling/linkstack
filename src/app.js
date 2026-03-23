// @ts-check
import { supabase } from "./lib/supabase.js";
import {
  captureException,
  initMonitoring,
  setMonitoringUser,
} from "./lib/monitoring.js";
import { AuthService } from "./services/auth.service.js";
import { APP_EVENTS } from "./constants/app-events.js";
import { BOOKMARK_SCOPE } from "./constants/bookmark-ui-state.js";
import { DEFAULT_HIGHLIGHT_COLOR } from "./constants/highlight-theme.js";
import {
  applyCachedHighlightColor,
  applyHighlightColor,
  cacheHighlightColorForUser,
  clearHighlightColorCache,
  getCachedHighlightColorForUser,
} from "./lib/highlight-theme.js";
import { UserPreferencesService } from "./services/user-preferences.service.js";

import "./linkstack-auth.js";
import "./linkstack-bookmarks-supabase.js";

const INITIAL_HIGHLIGHT_COLOR = applyCachedHighlightColor();

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
  #userPreferencesService = new UserPreferencesService(supabase);
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
  #highlightColor = INITIAL_HIGHLIGHT_COLOR;

  async init() {
    initMonitoring();
    this.#setupElements();
    this.#setupAuthListeners();
    this.#setupAdminToggle();
    this.#loadGuestShell();
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

  #loadGuestShell() {
    this.#updateScopeOptions(false);
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
      } catch (error) {
        captureException(error, {
          surface: "app",
          action: "sign-in-google",
        });
        this.#showToast(
          "Failed to sign in with Google. Please try again.",
          "error",
        );
      }
    });

    this.#authComponent?.addEventListener("sign-in-github", async () => {
      try {
        await this.#authService.signInWithGitHub();
      } catch (error) {
        captureException(error, {
          surface: "app",
          action: "sign-in-github",
        });
        this.#showToast(
          "Failed to sign in with GitHub. Please try again.",
          "error",
        );
      }
    });

    this.#authComponent?.addEventListener("sign-out", async () => {
      try {
        await this.#authService.signOut();
        this.#prepareHighlightColor(null);
        await this.#handleAuthChange(null, false);
      } catch (error) {
        captureException(error, {
          surface: "app",
          action: "sign-out",
        });
        this.#showToast("Failed to sign out. Please try again.", "error");
      }
    });

    this.#authComponent?.addEventListener(
      "highlight-color-change",
      async (event) => {
        const userId = this.#currentUser?.id;

        if (!(event instanceof CustomEvent) || !userId) {
          return;
        }

        const previousHighlightColor = this.#highlightColor;
        const nextHighlightColor = this.#setHighlightColor(
          event.detail?.highlightColor,
        );

        if (nextHighlightColor === previousHighlightColor) {
          return;
        }

        this.#highlightColor = nextHighlightColor;

        try {
          const savedHighlightColor =
            await this.#userPreferencesService.setHighlightColor(
              userId,
              nextHighlightColor,
            );

          this.#highlightColor = this.#setHighlightColor(savedHighlightColor);
          cacheHighlightColorForUser(userId, this.#highlightColor);
          this.#authComponent?.setHighlightColor(this.#highlightColor);
        } catch (error) {
          this.#highlightColor = this.#setHighlightColor(
            previousHighlightColor,
          );
          cacheHighlightColorForUser(userId, previousHighlightColor);
          this.#authComponent?.setHighlightColor(this.#highlightColor);
          captureException(error, {
            surface: "app",
            action: "save-highlight-color",
            userId,
            highlightColor: nextHighlightColor,
          });
          this.#showToast(
            "Couldn't save your highlight color. Please try again.",
            "error",
          );
        }
      },
    );

    this.#authService.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      // Avoid nested auth work inside Supabase's auth callback. Defer the
      // follow-up role lookup and UI sync to the next task.
      setTimeout(() => {
        void this.#syncAuthState(user, "auth-state-change");
      }, 0);
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
      await this.#syncAuthState(user, "check-auth-state");
    } catch (error) {
      captureException(error, {
        surface: "app",
        action: "check-auth-state",
      });
      this.#prepareHighlightColor(null);
      await this.#handleAuthChange(null, false);
    }
  }

  async #syncAuthState(user, action) {
    const isAdmin = await this.#resolveAdminState(user, action);
    this.#prepareHighlightColor(user);
    await this.#handleAuthChange(user, isAdmin);

    if (user) {
      void this.#reconcileHighlightColor(user, action);
    }
  }

  /**
   * @param {{ id: string } | null} user
   */
  #prepareHighlightColor(user) {
    if (!user) {
      clearHighlightColorCache();
      this.#highlightColor = this.#setHighlightColor(DEFAULT_HIGHLIGHT_COLOR);
      return;
    }

    const cachedHighlightColor = getCachedHighlightColorForUser(user.id);
    this.#highlightColor = this.#setHighlightColor(
      cachedHighlightColor ?? DEFAULT_HIGHLIGHT_COLOR,
    );
  }

  /**
   * @param {{ id: string } | null} user
   * @param {string} action
   */
  async #reconcileHighlightColor(user, action) {
    if (!user) {
      return;
    }

    try {
      const highlightColor = await this.#userPreferencesService.getHighlightColor(
        user.id,
      );

      if (this.#currentUser?.id !== user.id) {
        return;
      }

      this.#highlightColor = this.#setHighlightColor(highlightColor);
      cacheHighlightColorForUser(user.id, this.#highlightColor);
      this.#authComponent?.setHighlightColor(this.#highlightColor);
    } catch (error) {
      captureException(error, {
        surface: "app",
        action,
        authState: "highlight-color",
        userId: user.id,
      });
    }
  }

  async #resolveAdminState(user, action) {
    if (!user) {
      return false;
    }

    try {
      return await this.#authService.isAdmin(user.id);
    } catch (error) {
      captureException(error, {
        surface: "app",
        action,
        authState: "admin-check",
        userId: user.id,
      });

      return false;
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
    setMonitoringUser(user);

    if (user) {
      await this.#loadAuthenticatedComponents();
    }

    this.#authComponent?.setUser(user, {
      isAdmin,
      highlightColor: this.#highlightColor,
    });
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

  /**
   * @param {unknown} highlightColor
   * @returns {string}
   */
  #setHighlightColor(highlightColor) {
    return applyHighlightColor(highlightColor);
  }

  #setElementHidden(element, isHidden) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.hidden = isHidden;
    element.classList.toggle("hidden", isHidden);
  }
}

async function startApp() {
  const app = new LinkStackApp();
  await app.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void startApp();
  });
} else {
  void startApp();
}
