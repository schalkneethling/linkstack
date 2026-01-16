/**
 * Service for managing bookmarks with Supabase
 */
export class BookmarksService {
  #supabase;

  constructor(supabase) {
    this.#supabase = supabase;
  }

  /**
   * Get all bookmarks for the current user
   * @returns {Promise<Array>} Array of bookmark objects
   * @throws {Error} If fetch fails
   */
  async getAll() {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Get a single bookmark by ID
   * @param {string} id - Bookmark ID
   * @returns {Promise<Object>} Bookmark object
   * @throws {Error} If bookmark not found or fetch fails
   */
  async getById(id) {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create a new bookmark
   * @param {Object} bookmark - Bookmark data (url, page_title, meta_description, preview_img)
   * @returns {Promise<Object>} Created bookmark object
   * @throws {Error} If creation fails or bookmark already exists
   */
  async create(bookmark) {
    // Get current user
    const { data: { user }, error: authError } = await this.#supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      throw new Error("User must be authenticated to create bookmarks");
    }

    // Check if bookmark already exists for this user
    const { data: existing, error: checkError } = await this.#supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", bookmark.url)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existing) {
      throw new Error("You've already bookmarked this URL");
    }

    // Add user_id to bookmark data
    const bookmarkWithUser = {
      ...bookmark,
      user_id: user.id,
    };

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .insert(bookmarkWithUser)
      .select();

    if (error) {
      // Handle unique constraint violation from database
      if (error.code === '23505') {
        throw new Error("You've already bookmarked this URL");
      }
      throw error;
    }

    return data[0];
  }

  /**
   * Update an existing bookmark
   * @param {string} id - Bookmark ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated bookmark object
   * @throws {Error} If update fails or bookmark not found
   */
  async update(id, updates) {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(`Bookmark with id ${id} not found`);
    }

    return data[0];
  }

  /**
   * Delete a bookmark
   * @param {string} id - Bookmark ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   */
  async delete(id) {
    const { error } = await this.#supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
}
