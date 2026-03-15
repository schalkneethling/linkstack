// -check
import { beforeEach, describe, expect, it } from "vitest";
import {
  BookmarksService,
  PUBLIC_SHARE_STATUS,
} from "../../src/services/bookmarks.service.js";

class MockQueryBuilder {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this.operation = "select";
    this.filters = [];
    this.sortField = null;
    this.sortAscending = true;
    this.payload = null;
  }

  select() {
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field, values) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  order(field, { ascending }) {
    this.sortField = field;
    this.sortAscending = ascending;
    return this;
  }

  maybeSingle() {
    const result = this.#execute();
    return Promise.resolve({
      data: result.data[0] ?? null,
      error: null,
    });
  }

  single() {
    const result = this.#execute();
    return Promise.resolve({
      data: result.data[0] ?? null,
      error: result.data.length ? null : new Error("No rows"),
    });
  }

  then(resolve, reject) {
    try {
      resolve(this.#execute());
    } catch (error) {
      reject?.(error);
    }
  }

  #getTable() {
    return this.store[this.table];
  }

  #filteredRows() {
    let rows = [...this.#getTable()];
    this.filters.forEach((filter) => {
      rows = rows.filter(filter);
    });

    if (this.sortField) {
      rows.sort((left, right) => {
        const leftValue = left[this.sortField];
        const rightValue = right[this.sortField];
        if (leftValue === rightValue) {
          return 0;
        }
        if (this.sortAscending) {
          return leftValue > rightValue ? 1 : -1;
        }
        return leftValue < rightValue ? 1 : -1;
      });
    }

    return rows;
  }

  #execute() {
    if (this.operation === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = rows.map((row) => {
        const nextRow = {
          id: row.id || `${this.table}-${this.#getTable().length + 1}`,
          created_at: row.created_at || "2026-03-07T08:00:00Z",
          updated_at: row.updated_at || "2026-03-07T08:00:00Z",
          ...row,
        };
        this.#getTable().push(nextRow);
        return nextRow;
      });
      return { data: inserted, error: null };
    }

    if (this.operation === "update") {
      const updated = [];
      this.store[this.table] = this.#getTable().map((row) => {
        if (this.filters.every((filter) => filter(row))) {
          const nextRow = {
            ...row,
            ...this.payload,
            updated_at: "2026-03-07T09:00:00Z",
          };
          updated.push(nextRow);
          return nextRow;
        }
        return row;
      });
      return { data: updated, error: null };
    }

    if (this.operation === "delete") {
      const remaining = [];
      let deleted = false;
      this.#getTable().forEach((row) => {
        if (this.filters.every((filter) => filter(row))) {
          deleted = true;
          return;
        }
        remaining.push(row);
      });
      this.store[this.table] = remaining;
      return { data: [], error: deleted ? null : new Error("Delete failed") };
    }

    return {
      data: this.#filteredRows(),
      error: null,
    };
  }
}

describe("BookmarksService", () => {
  let service;
  let store;
  let mockSupabase;
  let currentUser;

  beforeEach(() => {
    currentUser = { id: "user-2", email: "person@example.com" };
    store = {
      resources: [
        {
          id: "resource-1",
          normalized_url: "https://example.com/article",
          canonical_url: "https://example.com/article",
          page_title: "Existing article",
          meta_description: "Existing description",
          created_at: "2026-03-06T08:00:00Z",
          updated_at: "2026-03-06T08:00:00Z",
        },
      ],
      bookmarks: [
        {
          id: "bookmark-1",
          user_id: "user-1",
          resource_id: "resource-1",
          parent_id: null,
          title_override: null,
          description_override: null,
          notes: "",
          tags: ["web"],
          is_read: false,
          read_at: null,
          created_at: "2026-03-06T09:00:00Z",
          updated_at: "2026-03-06T09:00:00Z",
        },
      ],
      public_listings: [
        {
          id: "listing-1",
          resource_id: "resource-1",
          submitted_by_user_id: "user-1",
          submitted_by_bookmark_id: "bookmark-1",
          status: "approved",
          page_title: "Existing article",
          meta_description: "Existing description",
          tags: ["web"],
          rejection_code: null,
          rejection_reason: null,
          reviewed_at: "2026-03-06T10:00:00Z",
          reviewed_by: "user-admin",
          created_at: "2026-03-06T09:30:00Z",
          updated_at: "2026-03-06T10:00:00Z",
        },
      ],
      user_roles: [{ id: "role-1", user_id: "user-admin", role: "admin" }],
    };

    mockSupabase = {
      auth: {
        getUser: async () => ({
          data: { user: currentUser },
          error: null,
        }),
      },
      from(table) {
        return new MockQueryBuilder(store, table);
      },
    };

    service = new BookmarksService(mockSupabase);
  });

  it("inspects a URL for both personal and public duplicates", async () => {
    store.bookmarks.push({
      id: "bookmark-2",
      user_id: "user-2",
      resource_id: "resource-1",
      parent_id: null,
      title_override: null,
      description_override: null,
      notes: "",
      tags: [],
      is_read: false,
      read_at: null,
      created_at: "2026-03-06T11:00:00Z",
      updated_at: "2026-03-06T11:00:00Z",
    });

    const inspection = await service.inspectUrl("https://example.com/article#fragment");

    expect(inspection.resource?.id).toBe("resource-1");
    expect(inspection.personal_duplicate?.id).toBe("bookmark-2");
    expect(inspection.public_duplicate?.id).toBe("listing-1");
  });

  it("creates a bookmark against an existing public resource without creating a new resource", async () => {
    const bookmark = await service.addExistingPublicToLibrary({
      resourceId: "resource-1",
      publicListingId: "listing-1",
      notes: "read later",
    });

    expect(store.resources).toHaveLength(1);
    expect(store.bookmarks).toHaveLength(2);
    expect(bookmark.resource_id).toBe("resource-1");
    expect(bookmark.notes).toBe("read later");
  });

  it("rejects addExistingPublicToLibrary input with an invalid resource id", async () => {
    await expect(
      service.addExistingPublicToLibrary({
        resourceId: /** @type {any} */ (null),
        publicListingId: "listing-1",
        notes: "read later",
      }),
    ).rejects.toThrow("Invalid type");
  });

  it("creates a new resource and bookmark when the URL is unknown", async () => {
    const bookmark = await service.create({
      url: "https://new.example.com/post",
      page_title: "A new article",
      meta_description: "Fresh description",
      notes: "todo",
      request_public: false,
    });

    expect(store.resources).toHaveLength(2);
    expect(store.bookmarks).toHaveLength(2);
    expect(bookmark.page_title).toBe("A new article");
    expect(bookmark.public_share_status).toBe(PUBLIC_SHARE_STATUS.NOT_REQUESTED);
  });

  it("rejects create input with an invalid URL", async () => {
    await expect(
      service.create({
        url: "javascript:alert(1)",
        page_title: "Bad URL",
        meta_description: "",
        notes: "",
        request_public: false,
      }),
    ).rejects.toThrow("URL must use http:// or https:// protocol");
  });

  it("prevents requesting public share when the resource is already public", async () => {
    store.bookmarks.push({
      id: "bookmark-2",
      user_id: "user-2",
      resource_id: "resource-1",
      parent_id: null,
      title_override: null,
      description_override: null,
      notes: "",
      tags: [],
      is_read: false,
      read_at: null,
      created_at: "2026-03-06T11:00:00Z",
      updated_at: "2026-03-06T11:00:00Z",
    });

    await expect(service.requestPublicShare("bookmark-2")).rejects.toThrow(
      "This link is already in the public catalog",
    );
  });

  it("creates a pending public listing for a private top-level bookmark", async () => {
    store.resources.push({
      id: "resource-2",
      normalized_url: "https://another.example.com/post",
      canonical_url: "https://another.example.com/post",
      page_title: "Another article",
      meta_description: "",
      created_at: "2026-03-07T07:00:00Z",
      updated_at: "2026-03-07T07:00:00Z",
    });
    store.bookmarks.push({
      id: "bookmark-2",
      user_id: "user-2",
      resource_id: "resource-2",
      parent_id: null,
      title_override: null,
      description_override: null,
      notes: "",
      tags: ["news"],
      is_read: false,
      read_at: null,
      created_at: "2026-03-07T07:10:00Z",
      updated_at: "2026-03-07T07:10:00Z",
    });

    const listing = await service.requestPublicShare("bookmark-2");

    expect(listing.status).toBe(PUBLIC_SHARE_STATUS.PENDING);
    expect(store.public_listings).toHaveLength(2);
  });

  it("auto-approves public listings submitted by admins", async () => {
    currentUser = { id: "user-admin", email: "admin@example.com" };
    store.resources.push({
      id: "resource-2",
      normalized_url: "https://admin.example.com/post",
      canonical_url: "https://admin.example.com/post",
      page_title: "Admin article",
      meta_description: "",
      created_at: "2026-03-07T07:00:00Z",
      updated_at: "2026-03-07T07:00:00Z",
    });
    store.bookmarks.push({
      id: "bookmark-2",
      user_id: "user-admin",
      resource_id: "resource-2",
      parent_id: null,
      title_override: null,
      description_override: null,
      notes: "",
      tags: ["news"],
      is_read: false,
      read_at: null,
      created_at: "2026-03-07T07:10:00Z",
      updated_at: "2026-03-07T07:10:00Z",
    });

    const listing = await service.requestPublicShare("bookmark-2");

    expect(listing.status).toBe(PUBLIC_SHARE_STATUS.APPROVED);
    expect(listing.reviewed_by).toBe("user-admin");
    expect(listing.reviewed_at).toBeTruthy();
  });

  it("reviews a pending public listing", async () => {
    store.public_listings.push({
      id: "listing-2",
      resource_id: "resource-1",
      submitted_by_user_id: "user-2",
      submitted_by_bookmark_id: "bookmark-1",
      status: "pending",
      page_title: "Existing article",
      meta_description: "Existing description",
      tags: ["web"],
      rejection_code: null,
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "2026-03-07T09:00:00Z",
      updated_at: "2026-03-07T09:00:00Z",
    });

    const reviewed = await service.reviewPublicShare("listing-2", {
      decision: "reject",
      rejectionCode: "out_of_scope",
      rejectionReason: "This link does not fit the catalog.",
    });

    expect(reviewed.status).toBe(PUBLIC_SHARE_STATUS.REJECTED);
    expect(reviewed.rejection_code).toBe("out_of_scope");
  });

  it("deletes the public listing and resource when removing the submitted bookmark", async () => {
    currentUser = { id: "user-1", email: "owner@example.com" };

    await service.delete("bookmark-1");

    expect(store.bookmarks).toHaveLength(0);
    expect(store.public_listings).toHaveLength(0);
    expect(store.resources).toHaveLength(0);
  });

  it("keeps the public listing and resource when deleting a private copy of a public resource", async () => {
    store.bookmarks.push({
      id: "bookmark-2",
      user_id: "user-2",
      resource_id: "resource-1",
      parent_id: null,
      title_override: null,
      description_override: null,
      notes: "",
      tags: [],
      is_read: false,
      read_at: null,
      created_at: "2026-03-06T11:00:00Z",
      updated_at: "2026-03-06T11:00:00Z",
    });

    await service.delete("bookmark-2");

    expect(store.bookmarks).toHaveLength(1);
    expect(store.bookmarks[0].id).toBe("bookmark-1");
    expect(store.public_listings).toHaveLength(1);
    expect(store.resources).toHaveLength(1);
  });

  it("requires a rejection reason when rejecting a public listing", async () => {
    await expect(
      service.reviewPublicShare("listing-1", {
        decision: "reject",
        rejectionCode: "",
        rejectionReason: "",
      }),
    ).rejects.toThrow("Choose a rejection reason before rejecting a bookmark.");
  });

  it("rejects update input with invalid tags", async () => {
    await expect(
      service.update("bookmark-1", {
        page_title: "Updated title",
        meta_description: "Updated description",
        notes: "",
        tags: /** @type {any} */ ("not-an-array"),
      }),
    ).rejects.toThrow("Invalid type");
  });

  it("throws when a fetched resource has an invalid shape", async () => {
    store.resources[0].canonical_url = /** @type {any} */ (null);

    await expect(
      service.inspectUrl("https://example.com/article"),
    ).rejects.toThrow("Invalid type");
  });

  it("throws when public listings returned from the database are malformed", async () => {
    store.public_listings[0].tags = /** @type {any} */ ("web");

    await expect(service.getPublicCatalog()).rejects.toThrow("Invalid type");
  });
});
