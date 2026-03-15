// @ts-check
import { SettingsService } from "./services/settings.service.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function createGuestTemplate() {
  const template = document.createElement("template");
  const wrapper = document.createElement("div");
  wrapper.className = "guest-auth";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "button solid";
  trigger.id = "guest-signin-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.dataset.testid = "signin-trigger";
  trigger.textContent = "Sign In";

  const menu = document.createElement("div");
  menu.className = "profile-dropdown guest-signin-menu";
  menu.id = "guest-signin-menu";

  const googleButton = document.createElement("button");
  googleButton.type = "button";
  googleButton.className = "dropdown-item";
  googleButton.dataset.testid = "google-signin";
  googleButton.id = "google-signin";
  googleButton.textContent = "Continue with Google";

  const githubButton = document.createElement("button");
  githubButton.type = "button";
  githubButton.className = "dropdown-item";
  githubButton.dataset.testid = "github-signin";
  githubButton.id = "github-signin";
  githubButton.textContent = "Continue with GitHub";

  menu.append(googleButton, githubButton);
  wrapper.append(trigger, menu);
  template.content.append(wrapper);

  return template;
}

function createAuthenticatedTemplate() {
  const template = document.createElement("template");
  const wrapper = document.createElement("div");
  wrapper.className = "user-profile";
  wrapper.dataset.testid = "user-info";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "profile-trigger";
  trigger.id = "profile-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.dataset.testid = "profile-trigger";

  const avatar = document.createElement("div");
  avatar.className = "profile-avatar";

  const name = document.createElement("span");
  name.className = "profile-name";

  const roleBadge = document.createElement("span");
  roleBadge.className = "profile-role-badge";
  roleBadge.setAttribute("aria-label", "Admin");
  roleBadge.hidden = true;
  roleBadge.textContent = "Admin";

  const arrow = document.createElementNS(SVG_NS, "svg");
  arrow.classList.add("profile-arrow");
  arrow.setAttribute("viewBox", "0 0 12 12");
  arrow.setAttribute("fill", "currentColor");
  arrow.setAttribute("aria-hidden", "true");

  const arrowPath = document.createElementNS(SVG_NS, "path");
  arrowPath.setAttribute("d", "M2 4l4 4 4-4");
  arrowPath.setAttribute("stroke", "currentColor");
  arrowPath.setAttribute("stroke-width", "2");
  arrowPath.setAttribute("fill", "none");
  arrowPath.setAttribute("stroke-linecap", "round");
  arrowPath.setAttribute("stroke-linejoin", "round");
  arrow.append(arrowPath);

  trigger.append(avatar, name, roleBadge, arrow);

  const dropdown = document.createElement("div");
  dropdown.className = "profile-dropdown";
  dropdown.id = "profile-dropdown";

  const userInfo = document.createElement("div");
  userInfo.className = "dropdown-user-info";

  const userName = document.createElement("div");
  userName.className = "dropdown-user-name";

  const userEmail = document.createElement("div");
  userEmail.className = "dropdown-user-email";
  userInfo.append(userName, userEmail);

  const limitSettings = document.createElement("div");
  limitSettings.className = "limit-settings";

  const limitToggleLabel = document.createElement("label");
  limitToggleLabel.className = "limit-toggle";

  const limitEnabled = document.createElement("input");
  limitEnabled.type = "checkbox";
  limitEnabled.id = "limit-enabled";
  limitEnabled.setAttribute("aria-label", "Enable unread bookmark limit");

  const limitLabel = document.createElement("span");
  limitLabel.className = "limit-label";
  limitLabel.textContent = "Limit unread bookmarks";

  limitToggleLabel.append(limitEnabled, limitLabel);

  const limitNumberContainer = document.createElement("div");
  limitNumberContainer.className = "limit-number-container";
  limitNumberContainer.id = "limit-number-container";
  limitNumberContainer.hidden = true;

  const unreadLimitLabel = document.createElement("label");
  unreadLimitLabel.className = "limit-number-label";
  unreadLimitLabel.setAttribute("for", "unread-limit");
  unreadLimitLabel.textContent = "Maximum unread:";

  const unreadLimit = document.createElement("input");
  unreadLimit.type = "number";
  unreadLimit.id = "unread-limit";
  unreadLimit.min = "1";
  unreadLimit.max = "100";
  unreadLimit.inputMode = "numeric";
  unreadLimit.className = "limit-input";
  unreadLimit.title = "Maximum number of unread bookmarks";
  unreadLimit.setAttribute("aria-label", "Unread bookmark limit");

  limitNumberContainer.append(unreadLimitLabel, unreadLimit);
  limitSettings.append(limitToggleLabel, limitNumberContainer);

  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.className = "dropdown-item danger";
  signOutButton.dataset.testid = "signout-btn";
  signOutButton.id = "signout-btn";
  signOutButton.textContent = "Sign Out";

  dropdown.append(userInfo, limitSettings, signOutButton);
  wrapper.append(trigger, dropdown);
  template.content.append(wrapper);

  return template;
}

const guestTemplate = createGuestTemplate();
const authenticatedTemplate = createAuthenticatedTemplate();

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
    const root = /** @type {DocumentFragment} */ (fragment);
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
      avatarContainer.replaceChildren();
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
      this.#closeGuestMenu();
      this.dispatchEvent(new CustomEvent("sign-in-google"));
      return;
    }

    if (target.closest("#github-signin")) {
      this.#closeGuestMenu();
      this.dispatchEvent(new CustomEvent("sign-in-github"));
      return;
    }

    if (target.closest("#signout-btn")) {
      this.dispatchEvent(new CustomEvent("sign-out"));
      return;
    }

    const guestTrigger = target.closest("#guest-signin-trigger");
    if (guestTrigger instanceof HTMLButtonElement) {
      event.stopPropagation();
      this.#toggleGuestMenu(guestTrigger);
      return;
    }

    const trigger = target.closest("#profile-trigger");
    if (trigger instanceof HTMLButtonElement) {
      event.stopPropagation();
      this.#toggleDropdown(trigger);
    }
  }

  #setupDropdown() {
    if (this.#documentClickHandler) {
      document.removeEventListener("click", this.#documentClickHandler);
    }

    this.#documentClickHandler = (event) => {
      if (!this.contains(event.target)) {
        this.#closeGuestMenu();
        this.#closeProfileDropdown();
      }
    };

    document.addEventListener("click", this.#documentClickHandler);
  }

  #toggleGuestMenu(trigger) {
    const menu = this.querySelector("#guest-signin-menu");
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    const isExpanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!isExpanded));
    menu.classList.toggle("active", !isExpanded);
  }

  #closeGuestMenu() {
    const trigger = this.querySelector("#guest-signin-trigger");
    const menu = this.querySelector("#guest-signin-menu");

    if (trigger instanceof HTMLButtonElement) {
      trigger.setAttribute("aria-expanded", "false");
    }

    if (menu instanceof HTMLElement) {
      menu.classList.remove("active");
    }
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

  #closeProfileDropdown() {
    const trigger = this.querySelector("#profile-trigger");
    const dropdown = this.querySelector("#profile-dropdown");

    if (trigger instanceof HTMLButtonElement) {
      trigger.setAttribute("aria-expanded", "false");
    }

    if (dropdown instanceof HTMLElement) {
      dropdown.classList.remove("active");
    }
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
