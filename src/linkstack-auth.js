// @ts-check
import { SettingsService } from "./services/settings.service.js";

const guestTemplate = document.createElement("template");
guestTemplate.innerHTML = `
  <div class="guest-auth">
    <button
      type="button"
      class="button solid"
      id="guest-signin-trigger"
      popovertarget="guest-signin-menu"
      data-testid="signin-trigger"
    >
      Sign In
    </button>
    <div class="profile-dropdown guest-signin-menu" id="guest-signin-menu" popover>
      <button
        type="button"
        class="dropdown-item"
        data-testid="google-signin"
        id="google-signin"
      >
        Continue with Google
      </button>
      <button
        type="button"
        class="dropdown-item"
        data-testid="github-signin"
        id="github-signin"
      >
        Continue with GitHub
      </button>
    </div>
  </div>
`;

const authenticatedTemplate = document.createElement("template");
authenticatedTemplate.innerHTML = `
  <div class="user-profile" data-testid="user-info">
    <button
      type="button"
      class="profile-trigger"
      aria-expanded="false"
      aria-haspopup="true"
      data-testid="profile-trigger"
      id="profile-trigger"
    >
      <div class="profile-avatar"></div>
      <span class="profile-name"></span>
      <span class="profile-role-badge" aria-label="Admin" hidden>Admin</span>
      <svg class="profile-arrow" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
    <div class="profile-dropdown" id="profile-dropdown">
      <div class="dropdown-user-info">
        <div class="dropdown-user-name"></div>
        <div class="dropdown-user-email"></div>
      </div>
      <div class="limit-settings">
        <label class="limit-toggle">
          <input
            type="checkbox"
            id="limit-enabled"
            aria-label="Enable unread bookmark limit"
          />
          <span class="limit-label">Limit unread bookmarks</span>
        </label>
        <div class="limit-number-container" id="limit-number-container" hidden>
          <label for="unread-limit" class="limit-number-label">Maximum unread:</label>
          <input
            type="number"
            id="unread-limit"
            min="1"
            max="100"
            inputmode="numeric"
            aria-label="Unread bookmark limit"
            class="limit-input"
            title="Maximum number of unread bookmarks"
          />
        </div>
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

export class LinkStackAuth extends HTMLElement {
  #user = null;
  #isAdmin = false;
  #settingsService = new SettingsService();
  #documentClickHandler = null;
  #hostClickHandler = null;

  connectedCallback() {
    if (!this.#hostClickHandler) {
      this.#hostClickHandler = (event) => {
        this.#handleClick(event);
      };
      this.addEventListener("click", this.#hostClickHandler);
    }

    this.#render();
  }

  disconnectedCallback() {
    if (this.#documentClickHandler) {
      document.removeEventListener("click", this.#documentClickHandler);
      this.#documentClickHandler = null;
    }

    if (this.#hostClickHandler) {
      this.removeEventListener("click", this.#hostClickHandler);
      this.#hostClickHandler = null;
    }
  }

  setUser(user, { isAdmin = false } = {}) {
    this.#user = user;
    this.#isAdmin = isAdmin;
    this.#render();
  }

  get updateComplete() {
    return Promise.resolve();
  }

  #render() {
    const fragment = this.#user
      ? this.#createAuthenticatedFragment()
      : guestTemplate.content.cloneNode(true);
    this.replaceChildren(fragment);

    if (this.#user) {
      this.#setupDropdown();
      this.#setupSettings();
    }
  }

  #createAuthenticatedFragment() {
    const displayName = this.#user.user_metadata?.full_name || this.#user.email;
    const email = this.#user.email;
    const avatar = this.#user.user_metadata?.avatar_url;
    const initials = this.#getInitials(displayName || email);
    const fragment = authenticatedTemplate.content.cloneNode(true);
    const root =
      /** @type {DocumentFragment} */ (fragment);
    const profileName = root.querySelector(".profile-name");
    const userName = root.querySelector(".dropdown-user-name");
    const userEmail = root.querySelector(".dropdown-user-email");
    const avatarContainer = root.querySelector(".profile-avatar");
    const roleBadge = root.querySelector(".profile-role-badge");

    if (
      !(profileName instanceof HTMLElement) ||
      !(userName instanceof HTMLElement) ||
      !(userEmail instanceof HTMLElement) ||
      !(roleBadge instanceof HTMLElement)
    ) {
      throw new Error("Authenticated auth template is missing required elements.");
    }

    profileName.textContent = displayName;
    userName.textContent = displayName;
    userEmail.textContent = email;
    roleBadge.hidden = !this.#isAdmin;

    if (avatarContainer instanceof HTMLElement) {
      if (avatar) {
        const avatarImage = document.createElement("img");
        avatarImage.src = avatar;
        avatarImage.alt = displayName || email;
        avatarContainer.append(avatarImage);
      } else {
        avatarContainer.textContent = initials;
      }
    }

    return root;
  }

  #handleClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    if (target.closest("#google-signin")) {
      this.dispatchEvent(new CustomEvent("sign-in-google"));
      return;
    }

    if (target.closest("#github-signin")) {
      this.dispatchEvent(new CustomEvent("sign-in-github"));
      return;
    }

    if (target.closest("#signout-btn")) {
      this.dispatchEvent(new CustomEvent("sign-out"));
      return;
    }

    const trigger = target.closest("#profile-trigger");
    if (trigger instanceof HTMLButtonElement) {
      event.stopPropagation();
      this.#toggleDropdown(trigger);
    }
  }

  #setupDropdown() {
    const trigger = this.querySelector("#profile-trigger");
    const dropdown = this.querySelector("#profile-dropdown");

    if (!trigger || !dropdown) {
      return;
    }

    if (this.#documentClickHandler) {
      document.removeEventListener("click", this.#documentClickHandler);
    }

    this.#documentClickHandler = (event) => {
      if (!this.contains(event.target)) {
        trigger.setAttribute("aria-expanded", "false");
        dropdown.classList.remove("active");
      }
    };

    document.addEventListener("click", this.#documentClickHandler);
  }

  #toggleDropdown(trigger) {
    const dropdown = this.querySelector("#profile-dropdown");
    if (!(dropdown instanceof HTMLElement)) {
      return;
    }

    const isExpanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!isExpanded));
    dropdown.classList.toggle("active", !isExpanded);
  }

  #setupSettings() {
    const limitEnabled = /** @type {HTMLInputElement | null} */ (
      this.querySelector("#limit-enabled")
    );
    const unreadLimit = /** @type {HTMLInputElement | null} */ (
      this.querySelector("#unread-limit")
    );
    const limitContainer = /** @type {HTMLElement | null} */ (
      this.querySelector("#limit-number-container")
    );

    if (!limitEnabled || !unreadLimit || !limitContainer) {
      return;
    }

    limitEnabled.checked = this.#settingsService.isLimitEnabled();
    unreadLimit.value = String(this.#settingsService.getUnreadLimit());
    limitContainer.hidden = !limitEnabled.checked;

    this.querySelector(".limit-settings")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    limitEnabled.addEventListener("change", (event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      this.#settingsService.setLimitEnabled(target.checked);
      limitContainer.hidden = !target.checked;
    });

    unreadLimit.addEventListener("change", (event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      const value = parseInt(target.value, 10);
      if (value >= 1 && value <= 100) {
        this.#settingsService.setUnreadLimit(value);
      }
    });
  }

  #getInitials(name) {
    if (!name) {
      return "U";
    }

    const parts = name.split(" ");
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }
}

if (!customElements.get("linkstack-auth")) {
  customElements.define("linkstack-auth", LinkStackAuth);
}
