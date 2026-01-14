import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "../../src/services/auth.service.js";

describe("AuthService", () => {
  let authService;
  let mockSupabase;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      auth: {
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    };

    authService = new AuthService(mockSupabase);
  });

  describe("signInWithGoogle", () => {
    it("should call supabase auth with Google provider", async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: "https://accounts.google.com/..." },
        error: null,
      });

      await authService.signInWithGoogle();

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
      });
    });

    it("should handle sign in errors", async () => {
      const error = new Error("OAuth failed");
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error,
      });

      await expect(authService.signInWithGoogle()).rejects.toThrow(
        "OAuth failed",
      );
    });
  });

  describe("signInWithGitHub", () => {
    it("should call supabase auth with GitHub provider", async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: "https://github.com/login/oauth/..." },
        error: null,
      });

      await authService.signInWithGitHub();

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
      });
    });
  });

  describe("signOut", () => {
    it("should call supabase signOut", async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await authService.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it("should handle sign out errors", async () => {
      const error = new Error("Sign out failed");
      mockSupabase.auth.signOut.mockResolvedValue({ error });

      await expect(authService.signOut()).rejects.toThrow("Sign out failed");
    });
  });

  describe("getCurrentUser", () => {
    it("should return current user from session", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      });

      const user = await authService.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it("should return null when no session exists", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const user = await authService.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe("onAuthStateChange", () => {
    it("should register auth state change callback", () => {
      const callback = vi.fn();
      const mockUnsubscribe = vi.fn();

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      authService.onAuthStateChange(callback);

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(
        callback,
      );
    });
  });
});
