import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("linkstack-auth", () => {
  let element;

  beforeEach(async () => {
    // Import and register the component
    await import("../../src/linkstack-auth.js");

    // Create a fresh element for each test
    element = document.createElement("linkstack-auth");
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should render sign in buttons when not authenticated", () => {
    const googleButton = element.querySelector('[data-testid="google-signin"]');
    const githubButton = element.querySelector('[data-testid="github-signin"]');

    expect(googleButton).toBeTruthy();
    expect(githubButton).toBeTruthy();
    expect(googleButton.textContent).toContain("Google");
    expect(githubButton.textContent).toContain("GitHub");
  });

  it("should render user info when authenticated", async () => {
    // Simulate authenticated state
    const mockUser = {
      email: "test@example.com",
      user_metadata: { full_name: "Test User" },
    };

    element.setUser(mockUser);
    await element.updateComplete;

    const userInfo = element.querySelector('[data-testid="user-info"]');
    const signOutButton = element.querySelector('[data-testid="signout-btn"]');

    expect(userInfo).toBeTruthy();
    expect(signOutButton).toBeTruthy();
    expect(userInfo.textContent).toContain("Test User");
  });

  it("should dispatch sign-in-google event when Google button clicked", async () => {
    const handler = vi.fn();
    element.addEventListener("sign-in-google", handler);

    const googleButton = element.querySelector('[data-testid="google-signin"]');
    googleButton.click();

    expect(handler).toHaveBeenCalled();
  });

  it("should dispatch sign-in-github event when GitHub button clicked", async () => {
    const handler = vi.fn();
    element.addEventListener("sign-in-github", handler);

    const githubButton = element.querySelector('[data-testid="github-signin"]');
    githubButton.click();

    expect(handler).toHaveBeenCalled();
  });

  it("should dispatch sign-out event when sign out button clicked", async () => {
    const mockUser = {
      email: "test@example.com",
    };

    element.setUser(mockUser);
    await element.updateComplete;

    const handler = vi.fn();
    element.addEventListener("sign-out", handler);

    const signOutButton = element.querySelector('[data-testid="signout-btn"]');
    signOutButton.click();

    expect(handler).toHaveBeenCalled();
  });
});
