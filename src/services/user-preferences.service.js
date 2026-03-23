// @ts-check

import {
  DEFAULT_HIGHLIGHT_COLOR,
  normalizeHighlightColor,
} from "../constants/highlight-theme.js";

export class UserPreferencesService {
  /**
   * @param {import("@supabase/supabase-js").SupabaseClient} supabase
   */
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getHighlightColor(userId) {
    const { data, error } = await this.supabase
      .from("user_preferences")
      .select("highlight_color")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return normalizeHighlightColor(
      data?.highlight_color ?? DEFAULT_HIGHLIGHT_COLOR,
    );
  }

  /**
   * @param {string} userId
   * @param {unknown} highlightColor
   * @returns {Promise<string>}
   */
  async setHighlightColor(userId, highlightColor) {
    const normalizedHighlightColor = normalizeHighlightColor(highlightColor);
    const { data, error } = await this.supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          highlight_color: normalizedHighlightColor,
        },
        {
          onConflict: "user_id",
        },
      )
      .select("highlight_color")
      .single();

    if (error) {
      throw error;
    }

    return normalizeHighlightColor(
      data?.highlight_color ?? normalizedHighlightColor,
    );
  }
}
