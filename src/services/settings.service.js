/**
 * Settings service for managing user preferences
 */
export class SettingsService {
  static KEYS = {
    LIMIT_ENABLED: "linkstack:limitEnabled",
    UNREAD_LIMIT: "linkstack:unreadLimit",
  };

  static DEFAULTS = {
    LIMIT_ENABLED: false,
    UNREAD_LIMIT: 10,
  };

  /**
   * Check if unread limit is enabled
   */
  isLimitEnabled() {
    const stored = localStorage.getItem(SettingsService.KEYS.LIMIT_ENABLED);
    return stored ? JSON.parse(stored) : SettingsService.DEFAULTS.LIMIT_ENABLED;
  }

  /**
   * Set limit enabled state
   */
  setLimitEnabled(enabled) {
    localStorage.setItem(
      SettingsService.KEYS.LIMIT_ENABLED,
      JSON.stringify(enabled),
    );
    window.dispatchEvent(
      new CustomEvent("settings-changed", {
        detail: { key: "limitEnabled", value: enabled },
      }),
    );
  }

  /**
   * Get unread limit value
   */
  getUnreadLimit() {
    const stored = localStorage.getItem(SettingsService.KEYS.UNREAD_LIMIT);
    return stored
      ? parseInt(stored, 10)
      : SettingsService.DEFAULTS.UNREAD_LIMIT;
  }

  /**
   * Set unread limit value
   */
  setUnreadLimit(limit) {
    const numericLimit = Math.max(1, parseInt(limit, 10));
    localStorage.setItem(SettingsService.KEYS.UNREAD_LIMIT, numericLimit);
    window.dispatchEvent(
      new CustomEvent("settings-changed", {
        detail: { key: "unreadLimit", value: numericLimit },
      }),
    );
  }
}
