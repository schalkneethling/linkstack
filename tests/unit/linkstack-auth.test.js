// -check
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("linkstack-auth", () => {
  let element;

  beforeEach(async () => {
    await import("../../src/linkstack-auth.js");
    element = document.createElement("linkstack-auth");
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a sign in trigger when there is no authenticated user", () => {
    expect(element.querySelector('[data-testid="signin-trigger"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="google-signin"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="github-signin"]')).toBeTruthy();
  });

  it("opens the guest sign-in menu when the trigger is clicked", () => {
    const trigger = /** @type {HTMLButtonElement} */ (
      element.querySelector('[data-testid="signin-trigger"]')
    );
    const menu = /** @type {HTMLElement} */ (
      element.querySelector("#guest-signin-menu")
    );

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.classList.contains("active")).toBe(true);
  });

  it("renders user info when authenticated", async () => {
    element.setUser(
      {
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
      },
      { isAdmin: true },
    );
    await element.updateComplete;

    expect(element.querySelector('[data-testid="user-info"]')).toBeTruthy();
    expect(element.textContent).toContain("Test User");
    expect(element.textContent).toContain("Admin");
  });

  it("dispatches sign-in-google on guest login button click", () => {
    const handler = vi.fn();
    element.addEventListener("sign-in-google", handler);

    element.querySelector('[data-testid="signin-trigger"]').click();
    element.querySelector('[data-testid="google-signin"]').click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches sign-out on sign out click", async () => {
    element.setUser({ email: "test@example.com", user_metadata: {} });
    await element.updateComplete;

    const handler = vi.fn();
    element.addEventListener("sign-out", handler);

    element.querySelector('[data-testid="signout-btn"]').click();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
