// @ts-check
import { supabase } from "./lib/supabase.js";
import { AuthService } from "./services/auth.service.js";

import "./linkstack-auth.js";
import "./linkstack-bookmarks-supabase.js";

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
      } catch (error) {
        console.info("Google sign in error:", error);
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
        console.info("GitHub sign in error:", error);
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
      } catch (error) {
        console.info("Sign out error:", error);
        this.#showToast("Failed to sign out. Please try again.", "error");
      }
    });

    this.#authService.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      const isAdmin = user ? await this.#authService.isAdmin() : false;
      await this.#handleAuthChange(user, isAdmin);
    });

    this.#scopeSelect?.addEventListener("change", async () => {
      if (this.#scopeSelect.value === "public") {
        this.#scopeSelect.value = "mine";
      }
      await this.#emitAuthStateChanged();
    });
  }

  #setupAdminToggle() {
    this.#adminButton?.addEventListener("click", () => {
      const isHidden = this.#adminPanel?.classList.contains("hidden");

      this.#adminPanel?.classList.toggle("hidden", !isHidden);
      this.#adminButton?.setAttribute("aria-pressed", String(isHidden));

      if (isHidden) {
        window.dispatchEvent(new CustomEvent("public-review-panel-opened"));
      }
    });
  }

  async #checkAuthState() {
    try {
      const user = await this.#authService.getCurrentUser();
      const isAdmin = user ? await this.#authService.isAdmin() : false;
      await this.#handleAuthChange(user, isAdmin);
    } catch (error) {
      console.info("Error checking auth state:", error);
      await this.#handleAuthChange(null, false);
    }
  }

  #updateScopeOptions(isAuthenticated) {
    if (!this.#scopeSelect || !this.#scopeLabel) {
      return;
    }

    if (isAuthenticated) {
      this.#scopeLabel.textContent = "Library:";
      this.#scopeSelect.innerHTML = `
        <option value="mine">My bookmarks</option>
        <option value="all">All bookmarks</option>
      `;

      if (![...this.#scopeSelect.options].some((option) => option.value === this.#scopeSelect.value)) {
        this.#scopeSelect.value = "mine";
      }
    } else {
      this.#scopeLabel.textContent = "Showing:";
      this.#scopeSelect.innerHTML = `
        <option value="public">Public bookmarks</option>
      `;
      this.#scopeSelect.value = "public";
    }
  }

  async #handleAuthChange(user, isAdmin) {
    this.#currentUser = user;
    this.#isAdmin = isAdmin;

    if (user) {
      await this.#loadAuthenticatedComponents();
    }

    this.#authComponent?.setUser(user, { isAdmin });
    this.#newBookmarkButton?.classList.toggle("hidden", !user);
    this.#formDrawer?.classList.toggle("hidden", !user);
    this.#adminButton?.classList.toggle("hidden", !(user && isAdmin));
    this.#adminPanel?.classList.add("hidden");

    this.#updateScopeOptions(Boolean(user));
    await this.#emitAuthStateChanged();
  }

  async #emitAuthStateChanged() {
    window.dispatchEvent(
      new CustomEvent("auth-state-changed", {
        detail: {
          user: this.#currentUser,
          isAuthenticated: Boolean(this.#currentUser),
          isAdmin: this.#isAdmin,
          scope: this.#scopeSelect?.value || "public",
        },
      }),
    );
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new LinkStackApp();
  });
} else {
  new LinkStackApp();
}
