// @ts-check
/**
 * Authentication service for handling user authentication with Supabase
 */
export class AuthService {
  #supabase;

  constructor(supabase) {
    this.#supabase = supabase;
  }

  /**
   * Get the redirect URL for OAuth based on current environment
   * @returns {string} The redirect URL
   */
  #getRedirectUrl() {
    // Use current origin for redirect
    // This works for both localhost:8888 (Netlify dev) and production
    return window.location.origin;
  }

  /**
   * Sign in with Google OAuth
   * @returns {Promise<void>}
   * @throws {Error} If sign in fails
   */
  async signInWithGoogle() {
    const { data, error } = await this.#supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: this.#getRedirectUrl(),
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Sign in with GitHub OAuth
   * @returns {Promise<void>}
   * @throws {Error} If sign in fails
   */
  async signInWithGitHub() {
    const { data, error } = await this.#supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: this.#getRedirectUrl(),
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   * @throws {Error} If sign out fails
   */
  async signOut() {
    const { error } = await this.#supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  /**
   * Get the currently authenticated user
   * @returns {Promise<object|null>}
   */
  async getCurrentUser() {
    const {
      data: { session },
      error,
    } = await this.#supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session?.user ?? null;
  }

  /**
   * Check whether the current user has the admin role.
   * @returns {Promise<boolean>}
   */
  async isAdmin() {
    const user = await this.getCurrentUser();

    if (!user) {
      return false;
    }

    const { data, error } = await this.#supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Subscribe to authentication state changes
   * @param {Function} callback - Function to call when auth state changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange(callback) {
    return this.#supabase.auth.onAuthStateChange(callback);
  }
}
