/**
 * Authentication component for LinkStack
 * Handles user sign in/out with Google and GitHub OAuth
 */
export class LinkStackAuth extends HTMLElement {
  #user = null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.#render();
  }

  /**
   * Set the current user and re-render
   * @param {Object|null} user - User object from Supabase auth
   */
  setUser(user) {
    this.#user = user;
    this.#render();
  }

  /**
   * Promise that resolves when render is complete (for testing)
   */
  get updateComplete() {
    return Promise.resolve();
  }

  #render() {
    if (this.#user) {
      this.#renderAuthenticatedView();
    } else {
      this.#renderSignInView();
    }
  }

  #renderSignInView() {
    this.innerHTML = `
      <div class="auth-container">
        <h2>Sign in to LinkStack</h2>
        <p class="auth-description">Save and manage your reading list across all your devices</p>

        <div class="auth-buttons">
          <button
            type="button"
            class="button solid auth-button"
            data-testid="google-signin"
            id="google-signin"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            class="button solid auth-button"
            data-testid="github-signin"
            id="github-signin"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Continue with GitHub
          </button>
        </div>
      </div>
    `;

    this.#attachEventListeners();
  }

  #renderAuthenticatedView() {
    // Debug: Log user object to inspect available data
    console.log("User object:", this.#user);
    console.log("User metadata:", this.#user.user_metadata);

    const displayName = this.#user.user_metadata?.full_name || this.#user.email;
    const email = this.#user.email;
    const avatar = this.#user.user_metadata?.avatar_url;
    const initials = this.#getInitials(displayName || email);

    // Debug: Log avatar URL
    console.log("Avatar URL:", avatar);

    // Hide the auth component (sign-in view)
    this.innerHTML = "";
    this.style.display = "none";

    // Show the header
    const header = document.getElementById("app-header");
    if (header) {
      header.classList.remove("hidden");
    }

    // Render profile in header
    const headerProfile = document.getElementById("header-profile");
    if (headerProfile) {
      headerProfile.innerHTML = `
        <div class="user-profile">
          <button
            type="button"
            class="profile-trigger"
            aria-expanded="false"
            aria-haspopup="true"
            data-testid="profile-trigger"
            id="profile-trigger"
          >
            <div class="profile-avatar">
              ${avatar ? `<img src="${avatar}" alt="${displayName}" />` : initials}
            </div>
            <span class="profile-name">${displayName}</span>
            <svg class="profile-arrow" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="profile-dropdown" id="profile-dropdown">
            <div class="dropdown-user-info">
              <div class="dropdown-user-name">${displayName}</div>
              <div class="dropdown-user-email">${email}</div>
            </div>
            <button
              type="button"
              class="dropdown-item danger"
              data-testid="signout-btn"
              id="signout-btn"
            >
              Sign Out
            </button>
          </div>
        </div>
      `;
    }

    this.#attachEventListeners();
    this.#setupDropdown();
  }

  /**
   * Get initials from name for avatar
   */
  #getInitials(name) {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Setup dropdown toggle functionality
   */
  #setupDropdown() {
    const trigger = document.getElementById("profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        this.#closeDropdown();
      } else {
        this.#openDropdown();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        this.#closeDropdown();
      }
    });

    // Close dropdown on ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.#closeDropdown();
      }
    });
  }

  #openDropdown() {
    const trigger = document.getElementById("profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (trigger && dropdown) {
      trigger.setAttribute("aria-expanded", "true");
      dropdown.classList.add("active");
    }
  }

  #closeDropdown() {
    const trigger = document.getElementById("profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (trigger && dropdown) {
      trigger.setAttribute("aria-expanded", "false");
      dropdown.classList.remove("active");
    }
  }

  #attachEventListeners() {
    const googleBtn = this.querySelector("#google-signin");
    const githubBtn = this.querySelector("#github-signin");
    const signOutBtn = this.querySelector("#signout-btn");

    if (googleBtn) {
      googleBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("sign-in-google"));
      });
    }

    if (githubBtn) {
      githubBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("sign-in-github"));
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("sign-out"));
      });
    }
  }
}

customElements.define("linkstack-auth", LinkStackAuth);
