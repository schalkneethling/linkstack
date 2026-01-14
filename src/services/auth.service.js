/**
 * Authentication service for handling user authentication with Supabase
 */
export class AuthService {
  #supabase;

  constructor(supabase) {
    this.#supabase = supabase;
  }

  /**
   * Sign in with Google OAuth
   * @returns {Promise<void>}
   * @throws {Error} If sign in fails
   */
  async signInWithGoogle() {
    const { data, error } = await this.#supabase.auth.signInWithOAuth({
      provider: "google",
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
   * @returns {Promise<User|null>}
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
   * Subscribe to authentication state changes
   * @param {Function} callback - Function to call when auth state changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange(callback) {
    return this.#supabase.auth.onAuthStateChange(callback);
  }
}
