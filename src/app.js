import { supabase } from "./lib/supabase.js";
import { AuthService } from "./services/auth.service.js";
import "./linkstack-auth.js";
import "./linkstack-form-supabase.js";
import "./linkstack-bookmarks-supabase.js";
import "./linkstack-edit-dialog-supabase.js";

/**
 * Main application coordinator
 * Handles authentication state and component orchestration
 */
class LinkStackApp {
  #authService = new AuthService(supabase);
  #authComponent = null;
  #mainContent = null;

  constructor() {
    this.#init();
  }

  async #init() {
    this.#setupElements();
    this.#setupAuthListeners();
    await this.#checkAuthState();
  }

  #setupElements() {
    this.#authComponent = document.querySelector("linkstack-auth");
    this.#mainContent = document.querySelector(".main-content");
  }

  #setupAuthListeners() {
    // Listen for sign-in events
    this.#authComponent?.addEventListener("sign-in-google", async () => {
      try {
        await this.#authService.signInWithGoogle();
      } catch (error) {
        console.error("Google sign in error:", error);
        const toast = document.querySelector("linkstack-toast");
        toast.show("Failed to sign in with Google. Please try again.", "error");
      }
    });

    this.#authComponent?.addEventListener("sign-in-github", async () => {
      try {
        await this.#authService.signInWithGitHub();
      } catch (error) {
        console.error("GitHub sign in error:", error);
        const toast = document.querySelector("linkstack-toast");
        toast.show("Failed to sign in with GitHub. Please try again.", "error");
      }
    });

    this.#authComponent?.addEventListener("sign-out", async () => {
      try {
        await this.#authService.signOut();
        this.#handleAuthChange(null);
      } catch (error) {
        console.error("Sign out error:", error);
        const toast = document.querySelector("linkstack-toast");
        toast.show("Failed to sign out. Please try again.", "error");
      }
    });

    // Listen for auth state changes
    this.#authService.onAuthStateChange((event, session) => {
      this.#handleAuthChange(session?.user ?? null);
    });
  }

  async #checkAuthState() {
    try {
      const user = await this.#authService.getCurrentUser();
      this.#handleAuthChange(user);
    } catch (error) {
      console.error("Error checking auth state:", error);
      this.#handleAuthChange(null);
    }
  }

  #handleAuthChange(user) {
    if (user) {
      // User is signed in
      this.#authComponent?.setUser(user);
      this.#mainContent?.classList.remove("hidden");
    } else {
      // User is signed out
      this.#authComponent?.setUser(null);
      this.#mainContent?.classList.add("hidden");
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new LinkStackApp();
  });
} else {
  new LinkStackApp();
}
