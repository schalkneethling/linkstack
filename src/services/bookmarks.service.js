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
   * @throws {Error} If creation fails
   */
  async create(bookmark) {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .insert(bookmark)
      .select();

    if (error) {
      throw error;
    }

    return data[0];
  }

  /**
   * Update an existing bookmark
   * @param {string} id - Bookmark ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated bookmark object
   * @throws {Error} If update fails
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
