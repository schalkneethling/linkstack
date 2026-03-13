// -check
import { normalizeUrl } from "../utils/normalize-url.js";

export const PUBLIC_SHARE_STATUS = {
  NOT_REQUESTED: "not_requested",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

/**
 * Service for managing resources, personal bookmarks, and moderated public listings.
 */
export class BookmarksService {
  #supabase;

  constructor(supabase) {
    this.#supabase = supabase;
  }

  async #getCurrentUser() {
    const {
      data: { user },
      error,
    } = await this.#supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user ?? null;
  }

  async #requireUser() {
    const user = await this.#getCurrentUser();

    if (!user) {
      throw new Error("User must be authenticated to perform this action");
    }

    return user;
  }

  async #fetchResources(resourceIds) {
    if (!resourceIds.length) {
      return new Map();
    }

    const { data, error } = await this.#supabase
      .from("resources")
      .select("*")
      .in("id", resourceIds);

    if (error) {
      throw error;
    }

    return new Map(data.map((resource) => [resource.id, resource]));
  }

  async #fetchPublicListings(resourceIds, statuses = []) {
    if (!resourceIds.length) {
      return new Map();
    }

    let query = this.#supabase
      .from("public_listings")
      .select("*")
      .in("resource_id", resourceIds);

    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    }

    if (statuses.length > 1) {
      query = query.in("status", statuses);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return new Map(data.map((listing) => [listing.resource_id, listing]));
  }

  #applySort(query, sortBy, dateField = "created_at", alphaField = "page_title") {
    switch (sortBy) {
      case "oldest":
        return query.order(dateField, { ascending: true });
      case "alpha-asc":
        return query.order(alphaField, { ascending: true });
      case "alpha-desc":
        return query.order(alphaField, { ascending: false });
      case "newest":
      default:
        return query.order(dateField, { ascending: false });
    }
  }

  #sortFeed(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case "oldest":
        sorted.sort(
          (left, right) =>
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime(),
        );
        break;
      case "alpha-asc":
        sorted.sort((left, right) =>
          (left.page_title || "").localeCompare(right.page_title || ""),
        );
        break;
      case "alpha-desc":
        sorted.sort((left, right) =>
          (right.page_title || "").localeCompare(left.page_title || ""),
        );
        break;
      case "newest":
      default:
        sorted.sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        );
        break;
    }

    return sorted;
  }

  #toBookmarkViewModel(bookmark, resource, listing, currentUserId) {
    return {
      id: bookmark.id,
      resource_id: bookmark.resource_id,
      parent_id: bookmark.parent_id,
      url: resource?.canonical_url,
      normalized_url: resource?.normalized_url,
      page_title: bookmark.title_override || resource?.page_title || "",
      meta_description:
        bookmark.description_override || resource?.meta_description || "",
      preview_img: resource?.preview_img || "",
      notes: bookmark.notes || "",
      tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
      is_read: Boolean(bookmark.is_read),
      created_at: bookmark.created_at,
      updated_at: bookmark.updated_at,
      kind: "bookmark",
      ownership: "mine",
      can_toggle_read: true,
      can_edit: true,
      can_delete: true,
      can_save_copy: false,
      public_share_status: listing?.status || PUBLIC_SHARE_STATUS.NOT_REQUESTED,
      public_rejection_code: listing?.rejection_code || "",
      public_rejection_reason: listing?.rejection_reason || "",
      is_public_listing_owner:
        Boolean(listing?.submitted_by_user_id) &&
        listing.submitted_by_user_id === currentUserId,
      is_public_resource: listing?.status === PUBLIC_SHARE_STATUS.APPROVED,
      public_listing_id: listing?.id || null,
    };
  }

  #toPublicViewModel(listing, resource) {
    return {
      id: `public-${listing.id}`,
      public_listing_id: listing.id,
      resource_id: listing.resource_id,
      url: resource?.canonical_url,
      normalized_url: resource?.normalized_url,
      page_title: listing.page_title || resource?.page_title || "",
      meta_description:
        listing.meta_description || resource?.meta_description || "",
      preview_img: listing.preview_img || resource?.preview_img || "",
      tags: Array.isArray(listing.tags) ? listing.tags : [],
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      kind: "public",
      ownership: "public",
      can_toggle_read: false,
      can_edit: false,
      can_delete: false,
      can_save_copy: true,
      public_share_status: PUBLIC_SHARE_STATUS.APPROVED,
      public_rejection_code: "",
      public_rejection_reason: "",
      is_public_listing_owner: false,
      is_public_resource: true,
    };
  }

  async inspectUrl(url) {
    const normalized = normalizeUrl(url);
    const user = await this.#getCurrentUser();
    const resource = await this.findResourceByNormalizedUrl(normalized);
    let personalDuplicate = null;
    let publicDuplicate = null;

    if (resource && user) {
      personalDuplicate = await this.findBookmarkByResourceId(resource.id, user.id);
    }

    if (resource) {
      publicDuplicate = await this.findApprovedPublicListing(resource.id);
    }

    return {
      normalized_url: normalized,
      resource,
      personal_duplicate: personalDuplicate,
      public_duplicate: publicDuplicate,
    };
  }

  async findResourceByNormalizedUrl(normalizedUrl) {
    const { data, error } = await this.#supabase
      .from("resources")
      .select("*")
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findBookmarkByResourceId(resourceId, userId = null) {
    const targetUserId = userId || (await this.#requireUser()).id;

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findApprovedPublicListing(resourceId) {
    const { data, error } = await this.#supabase
      .from("public_listings")
      .select("*")
      .eq("resource_id", resourceId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async #findPublicListing(resourceId) {
    const { data, error } = await this.#supabase
      .from("public_listings")
      .select("*")
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async #createResource(bookmark) {
    const normalizedUrl = normalizeUrl(bookmark.url);
    const resourcePayload = {
      normalized_url: normalizedUrl,
      canonical_url: bookmark.url,
      page_title: bookmark.page_title,
      meta_description: bookmark.meta_description || "",
      preview_img: bookmark.preview_img || "",
    };

    const { data, error } = await this.#supabase
      .from("resources")
      .insert(resourcePayload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async #createBookmarkRow(resource, bookmark, userId, defaults = {}) {
    const bookmarkPayload = {
      user_id: userId,
      resource_id: resource.id,
      parent_id: bookmark.parent_id || null,
      notes: bookmark.notes || "",
      tags: bookmark.tags || defaults.tags || [],
      title_override: defaults.title_override || null,
      description_override: defaults.description_override || null,
    };

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .insert(bookmarkPayload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("You've already bookmarked this URL");
      }
      throw error;
    }

    return data;
  }

  async #hydrateBookmarks(bookmarks, currentUserId) {
    if (!bookmarks.length) {
      return [];
    }

    const resourceIds = [...new Set(bookmarks.map((bookmark) => bookmark.resource_id))];
    const [resources, publicListings] = await Promise.all([
      this.#fetchResources(resourceIds),
      this.#fetchPublicListings(resourceIds, [
        PUBLIC_SHARE_STATUS.PENDING,
        PUBLIC_SHARE_STATUS.APPROVED,
        PUBLIC_SHARE_STATUS.REJECTED,
      ]),
    ]);

    return bookmarks.map((bookmark) =>
      this.#toBookmarkViewModel(
        bookmark,
        resources.get(bookmark.resource_id),
        publicListings.get(bookmark.resource_id),
        currentUserId,
      ),
    );
  }

  async getMyBookmarks(sortBy = "newest") {
    const user = await this.#requireUser();

    let query = this.#supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id);

    query = this.#applySort(query, sortBy);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return this.#hydrateBookmarks(data || [], user.id);
  }

  async getTopLevel(sortBy = "newest") {
    const bookmarks = await this.getMyBookmarks(sortBy);
    return bookmarks.filter((bookmark) => !bookmark.parent_id);
  }

  async getChildren(parentId, sortBy = "newest") {
    const bookmarks = await this.getMyBookmarks(sortBy);
    return bookmarks.filter((bookmark) => bookmark.parent_id === parentId);
  }

  async getPublicCatalog(sortBy = "newest") {
    let query = this.#supabase
      .from("public_listings")
      .select("*")
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED);

    query = this.#applySort(query, sortBy, "reviewed_at", "page_title");

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const resources = await this.#fetchResources(
      data.map((listing) => listing.resource_id),
    );

    return data.map((listing) =>
      this.#toPublicViewModel(listing, resources.get(listing.resource_id)),
    );
  }

  async getCombinedFeed(sortBy = "newest") {
    const [myBookmarks, publicCatalog] = await Promise.all([
      this.getMyBookmarks(sortBy),
      this.getPublicCatalog(sortBy),
    ]);

    const ownedResources = new Set(
      myBookmarks.map((bookmark) => bookmark.resource_id),
    );
    const publicOnly = publicCatalog.filter(
      (listing) => !ownedResources.has(listing.resource_id),
    );

    return this.#sortFeed([...myBookmarks, ...publicOnly], sortBy);
  }

  async getById(id) {
    const user = await this.#requireUser();
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }

    const hydrated = await this.#hydrateBookmarks([data], user.id);
    return hydrated[0];
  }

  async create(bookmark) {
    const user = await this.#requireUser();
    const inspection = await this.inspectUrl(bookmark.url);

    if (inspection.personal_duplicate) {
      throw new Error("You've already bookmarked this URL");
    }

    if (bookmark.request_public && inspection.public_duplicate) {
      throw new Error("This link is already in the public catalog");
    }

    let resource = inspection.resource;

    if (!resource) {
      resource = await this.#createResource(bookmark);
    }

    const createdBookmark = await this.#createBookmarkRow(resource, bookmark, user.id);

    if (bookmark.request_public) {
      await this.requestPublicShare(createdBookmark.id);
    }

    return this.getById(createdBookmark.id);
  }

  async addExistingPublicToLibrary({
    resourceId,
    publicListingId,
    notes = "",
    parentId = null,
  }) {
    const user = await this.#requireUser();
    const duplicate = await this.findBookmarkByResourceId(resourceId, user.id);

    if (duplicate) {
      throw new Error("You've already bookmarked this URL");
    }

    const { data: listing, error: listingError } = await this.#supabase
      .from("public_listings")
      .select("*")
      .eq("id", publicListingId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .single();

    if (listingError) {
      throw listingError;
    }

    const { data: resource, error: resourceError } = await this.#supabase
      .from("resources")
      .select("*")
      .eq("id", resourceId)
      .single();

    if (resourceError) {
      throw resourceError;
    }

    const bookmark = await this.#createBookmarkRow(
      resource,
      {
        notes,
        parent_id: parentId,
      },
      user.id,
      {
        tags: listing.tags || [],
        title_override:
          listing.page_title && listing.page_title !== resource.page_title
            ? listing.page_title
            : null,
        description_override:
          listing.meta_description &&
          listing.meta_description !== resource.meta_description
            ? listing.meta_description
            : null,
      },
    );

    return this.getById(bookmark.id);
  }

  async update(id, updates) {
    const existing = await this.getById(id);

    const payload = {
      title_override: updates.page_title || null,
      description_override: updates.meta_description || null,
      notes: updates.notes || "",
      tags: updates.tags || [],
    };

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const listing = await this.#findPublicListing(existing.resource_id);
    const shouldResubmit =
      listing &&
      listing.status === PUBLIC_SHARE_STATUS.APPROVED &&
      listing.submitted_by_bookmark_id === id &&
      (existing.page_title !== (updates.page_title || "") ||
        existing.meta_description !== (updates.meta_description || "") ||
        JSON.stringify(existing.tags || []) !== JSON.stringify(updates.tags || []));

    if (shouldResubmit) {
      await this.requestPublicShare(id);
    }

    return this.getById(data.id);
  }

  async delete(id) {
    const { error } = await this.#supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async toggleReadStatus(id, isRead) {
    const updates = {
      is_read: isRead,
      read_at: isRead ? new Date().toISOString() : null,
    };

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return this.getById(data.id);
  }

  async requestPublicShare(bookmarkId) {
    const user = await this.#requireUser();
    const bookmark = await this.getById(bookmarkId);

    if (bookmark.parent_id) {
      throw new Error("Only top-level bookmarks can be submitted publicly");
    }

    const approvedDuplicate = await this.findApprovedPublicListing(bookmark.resource_id);
    if (approvedDuplicate && approvedDuplicate.submitted_by_user_id !== user.id) {
      throw new Error("This link is already in the public catalog");
    }

    const existingListing = await this.#findPublicListing(bookmark.resource_id);
    const payload = {
      resource_id: bookmark.resource_id,
      submitted_by_user_id: user.id,
      submitted_by_bookmark_id: bookmark.id,
      status: PUBLIC_SHARE_STATUS.PENDING,
      page_title: bookmark.page_title,
      meta_description: bookmark.meta_description,
      preview_img: bookmark.preview_img,
      tags: bookmark.tags || [],
      rejection_code: null,
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by: null,
    };

    let listing;

    if (existingListing) {
      const { data, error } = await this.#supabase
        .from("public_listings")
        .update(payload)
        .eq("id", existingListing.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      listing = data;
    } else {
      const { data, error } = await this.#supabase
        .from("public_listings")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      listing = data;
    }

    return listing;
  }

  async getPendingPublicListings(sortBy = "newest") {
    const { data, error } = await this.#applySort(
      this.#supabase
        .from("public_listings")
        .select("*")
        .eq("status", PUBLIC_SHARE_STATUS.PENDING),
      sortBy,
      "created_at",
      "page_title",
    );

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const resources = await this.#fetchResources(
      data.map((listing) => listing.resource_id),
    );

    return data.map((listing) => ({
      ...this.#toPublicViewModel(listing, resources.get(listing.resource_id)),
      submitted_by_user_id: listing.submitted_by_user_id,
      submitted_by_bookmark_id: listing.submitted_by_bookmark_id,
      public_share_status: listing.status,
    }));
  }

  async reviewPublicShare(id, { decision, rejectionCode = null, rejectionReason = "" }) {
    const reviewer = await this.#requireUser();
    const status =
      decision === "approve"
        ? PUBLIC_SHARE_STATUS.APPROVED
        : PUBLIC_SHARE_STATUS.REJECTED;

    const { data, error } = await this.#supabase
      .from("public_listings")
      .update({
        status,
        rejection_code: status === PUBLIC_SHARE_STATUS.REJECTED ? rejectionCode : null,
        rejection_reason:
          status === PUBLIC_SHARE_STATUS.REJECTED ? rejectionReason : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer.id,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async savePublicCopy(publicListingId) {
    const { data: listing, error } = await this.#supabase
      .from("public_listings")
      .select("*")
      .eq("id", publicListingId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .single();

    if (error) {
      throw error;
    }

    return this.addExistingPublicToLibrary({
      resourceId: listing.resource_id,
      publicListingId,
    });
  }

  async fetchAll() {
    return this.getMyBookmarks();
  }
}
