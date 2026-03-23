// @ts-check
import { beforeEach, describe, expect, it } from "vitest";
import { UserPreferencesService } from "../../src/services/user-preferences.service.js";

class MockUserPreferencesQuery {
  constructor(store) {
    this.store = store;
    this.filters = [];
    this.operation = "select";
    this.payload = null;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  upsert(payload) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    const row = this.#filteredRows()[0] ?? null;
    return Promise.resolve({
      data: row,
      error: null,
    });
  }

  single() {
    const rows = this.#execute();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows.length ? null : new Error("No rows"),
    });
  }

  #filteredRows() {
    return this.store.user_preferences.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
  }

  #execute() {
    if (this.operation !== "upsert" || !this.payload) {
      return this.#filteredRows();
    }

    const existingIndex = this.store.user_preferences.findIndex(
      (row) => row.user_id === this.payload.user_id,
    );

    const nextRow = {
      id:
        existingIndex >= 0
          ? this.store.user_preferences[existingIndex].id
          : `preference-${this.store.user_preferences.length + 1}`,
      created_at:
        existingIndex >= 0
          ? this.store.user_preferences[existingIndex].created_at
          : "2026-03-23T08:00:00Z",
      updated_at: "2026-03-23T09:00:00Z",
      ...this.payload,
    };

    if (existingIndex >= 0) {
      this.store.user_preferences[existingIndex] = nextRow;
    } else {
      this.store.user_preferences.push(nextRow);
    }

    return [nextRow];
  }
}

describe("UserPreferencesService", () => {
  let store;
  let service;

  beforeEach(() => {
    store = {
      user_preferences: [],
    };

    service = new UserPreferencesService(
      /** @type {import("@supabase/supabase-js").SupabaseClient} */ (
        /** @type {unknown} */ ({
      from: (table) => {
        if (table !== "user_preferences") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return new MockUserPreferencesQuery(store);
      },
        })
      ),
    );
  });

  it("returns the default highlight color when a preference row does not exist", async () => {
    await expect(service.getHighlightColor("user-1")).resolves.toBe("default");
  });

  it("upserts the highlight color for a user", async () => {
    await expect(service.setHighlightColor("user-1", "rose")).resolves.toBe(
      "rose",
    );

    expect(store.user_preferences).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        highlight_color: "rose",
      }),
    ]);
  });

  it("normalizes invalid stored values back to the default theme", async () => {
    store.user_preferences.push({
      id: "preference-1",
      user_id: "user-1",
      highlight_color: "invalid-color",
      created_at: "2026-03-23T08:00:00Z",
      updated_at: "2026-03-23T08:00:00Z",
    });

    await expect(service.getHighlightColor("user-1")).resolves.toBe("default");
  });
});
