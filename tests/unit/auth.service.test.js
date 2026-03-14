// -check
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "../../src/services/auth.service.js";

describe("AuthService", () => {
  let authService;
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = {
      auth: {
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      maybeSingle: vi.fn(),
    };

    authService = new AuthService(mockSupabase);
  });

  it("signs in with google using the current origin as redirect", async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com" },
      error: null,
    });

    await authService.signInWithGoogle();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  });

  it("signs in with github using the current origin as redirect", async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://github.com/login/oauth" },
      error: null,
    });

    await authService.signInWithGitHub();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
  });

  it("returns the current session user", async () => {
    const user = { id: "user-1", email: "test@example.com" };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user } },
      error: null,
    });

    await expect(authService.getCurrentUser()).resolves.toEqual(user);
  });

  it("returns false for isAdmin when there is no user", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(authService.isAdmin()).resolves.toBe(false);
  });

  it("returns true for isAdmin when the admin role exists", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { role: "admin" },
      error: null,
    });

    await expect(authService.isAdmin()).resolves.toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("user_roles");
  });
});
