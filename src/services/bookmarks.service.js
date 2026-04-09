// @ts-check
import { BOOKMARK_SORT } from "../constants/bookmark-ui-state.js";
import {
  BOOKMARK_KIND,
  BOOKMARK_OWNERSHIP,
  PUBLIC_SHARE_STATUS,
  REVIEW_DECISION,
} from "../constants/bookmark-model.js";
import {
  getInitialStackItemState,
  getInitialSubmissionState,
  getReviewTargetConfig,
  getReviewedState,
  PUBLICATION_REVIEW_KIND,
} from "../domain/publication-state.js";
import {
  STACK_DELETION_EVENT,
  STACK_DELETION_STATE,
  transitionStackDeletionState,
} from "../domain/stack-deletion-state.js";
import { normalizeUrl } from "../utils/normalize-url.js";
import {
  validateAddExistingPublicBookmarkInput,
  validateBookmarkReference,
  validateBookmarkRecord,
  validateBookmarkRecords,
  getValidationMessage,
  validatePublicListingRecord,
  validatePublicListingRecords,
  validatePublicListingReference,
  validatePublicStackItemRecord,
  validatePublicStackItemRecords,
  validatePublicStackRecord,
  validatePublicStackRecords,
  validateResolveRootDeletionInput,
  validateResourceRecord,
  validateResourceRecords,
  validateCreateBookmarkInput,
  validateReviewPublicShareInput,
  validateSubmitPublicStackInput,
  validateUpdateBookmarkInput,
} from "../utils/validation-schemas.js";

export { PUBLIC_SHARE_STATUS } from "../constants/bookmark-model.js";

/** @typedef {import("../constants/bookmark-ui-state.js").BookmarkSort} BookmarkSort */
/** @typedef {import("../constants/bookmark-model.js").ReviewDecision} ReviewDecision */

const RESOURCE_FIELDS = [
  "id",
  "normalized_url",
  "canonical_url",
  "page_title",
  "meta_description",
].join(", ");

const BOOKMARK_FIELDS = [
  "id",
  "user_id",
  "resource_id",
  "parent_id",
  "notes",
  "tags",
  "title_override",
  "description_override",
  "is_read",
  "read_at",
  "created_at",
  "updated_at",
].join(", ");

const PUBLIC_LISTING_FIELDS = [
  "id",
  "resource_id",
  "submitted_by_user_id",
  "submitted_by_bookmark_id",
  "status",
  "page_title",
  "meta_description",
  "tags",
  "rejection_code",
  "rejection_reason",
  "reviewed_at",
  "reviewed_by",
  "created_at",
  "updated_at",
].join(", ");

const PUBLIC_STACK_FIELDS = [
  "id",
  "root_bookmark_id",
  "resource_id",
  "owner_user_id",
  "status",
  "page_title",
  "meta_description",
  "tags",
  "rejection_code",
  "rejection_reason",
  "reviewed_at",
  "reviewed_by",
  "created_at",
  "updated_at",
].join(", ");

const PUBLIC_STACK_ITEM_FIELDS = [
  "id",
  "public_stack_id",
  "bookmark_id",
  "resource_id",
  "source_public_listing_id",
  "status",
  "page_title",
  "meta_description",
  "tags",
  "display_order",
  "rejection_code",
  "rejection_reason",
  "reviewed_at",
  "reviewed_by",
  "created_at",
  "updated_at",
].join(", ");

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

  async #isAdmin(userId) {
    const { data, error } = await this.#supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * @template T
   * @param {{ success: true, output: T } | { success: false, issues?: Array<{ message?: string }> }} result
   * @param {string} fallbackMessage
   * @returns {T}
   */
  #requireValid(result, fallbackMessage) {
    if (!result.success) {
      throw new Error(
        getValidationMessage(
          /** @type {{ issues?: Array<{ message?: string }> }} */ (result),
          fallbackMessage,
        ),
      );
    }

    return result.output;
  }

  async #fetchResources(resourceIds) {
    if (!resourceIds.length) {
      return new Map();
    }

    const { data, error } = await this.#supabase
      .from("resources")
      .select(RESOURCE_FIELDS)
      .in("id", resourceIds);

    if (error) {
      throw error;
    }

    const resources = this.#requireValid(
      validateResourceRecords(data || []),
      "Received invalid resource records from the database.",
    );

    return new Map(resources.map((resource) => [resource.id, resource]));
  }

  async #fetchPublicListings(resourceIds, statuses = []) {
    if (!resourceIds.length) {
      return new Map();
    }

    let query = this.#supabase
      .from("public_listings")
      .select(PUBLIC_LISTING_FIELDS)
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

    const listings = this.#requireValid(
      validatePublicListingRecords(data || []),
      "Received invalid public listing records from the database.",
    );

    return new Map(listings.map((listing) => [listing.resource_id, listing]));
  }

  async #fetchPublicStacksByRootIds(rootBookmarkIds, statuses = []) {
    if (!rootBookmarkIds.length) {
      return new Map();
    }

    let query = this.#supabase
      .from("public_stacks")
      .select(PUBLIC_STACK_FIELDS)
      .in("root_bookmark_id", rootBookmarkIds);

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

    const stacks = this.#requireValid(
      validatePublicStackRecords(data || []),
      "Received invalid public stack records from the database.",
    );

    return new Map(stacks.map((stack) => [stack.root_bookmark_id, stack]));
  }

  async #fetchPublicStackItemsByBookmarkIds(bookmarkIds, statuses = []) {
    if (!bookmarkIds.length) {
      return new Map();
    }

    let query = this.#supabase
      .from("public_stack_items")
      .select(PUBLIC_STACK_ITEM_FIELDS)
      .in("bookmark_id", bookmarkIds);

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

    const items = this.#requireValid(
      validatePublicStackItemRecords(data || []),
      "Received invalid public stack item records from the database.",
    );

    return new Map(items.map((item) => [item.bookmark_id, item]));
  }

  async #fetchPublicStackItemsByStackIds(stackIds, statuses = []) {
    if (!stackIds.length) {
      return [];
    }

    let query = this.#supabase
      .from("public_stack_items")
      .select(PUBLIC_STACK_ITEM_FIELDS)
      .in("public_stack_id", stackIds);

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

    return this.#requireValid(
      validatePublicStackItemRecords(data || []),
      "Received invalid public stack item records from the database.",
    );
  }

  /**
   * @param {any} query
   * @param {BookmarkSort} sortBy
   * @param {string} [dateField]
   * @param {string} [alphaField]
   */
  #applySort(query, sortBy, dateField = "created_at", alphaField = "page_title") {
    switch (sortBy) {
      case BOOKMARK_SORT.oldest:
        return query.order(dateField, { ascending: true });
      case BOOKMARK_SORT.alphaAsc:
        return query.order(alphaField, { ascending: true });
      case BOOKMARK_SORT.alphaDesc:
        return query.order(alphaField, { ascending: false });
      case BOOKMARK_SORT.newest:
      default:
        return query.order(dateField, { ascending: false });
    }
  }

  /**
   * @param {BookmarkSort} sortBy
   * @returns {boolean}
   */
  #usesAlphaSort(sortBy) {
    return (
      sortBy === BOOKMARK_SORT.alphaAsc || sortBy === BOOKMARK_SORT.alphaDesc
    );
  }

  /**
   * @param {Array<any>} items
   * @param {BookmarkSort} sortBy
   */
  #sortFeed(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case BOOKMARK_SORT.oldest:
        sorted.sort(
          (left, right) =>
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime(),
        );
        break;
      case BOOKMARK_SORT.alphaAsc:
        sorted.sort((left, right) =>
          (left.page_title || "").localeCompare(right.page_title || ""),
        );
        break;
      case BOOKMARK_SORT.alphaDesc:
        sorted.sort((left, right) =>
          (right.page_title || "").localeCompare(left.page_title || ""),
        );
        break;
      case BOOKMARK_SORT.newest:
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

  #toBookmarkViewModel(
    bookmark,
    resource,
    listing,
    currentUserId,
    publicStack = null,
    publicStackItem = null,
  ) {
    return {
      id: bookmark.id,
      resource_id: bookmark.resource_id,
      parent_id: bookmark.parent_id,
      url: resource?.canonical_url,
      normalized_url: resource?.normalized_url,
      page_title: bookmark.title_override || resource?.page_title || "",
      meta_description:
        bookmark.description_override || resource?.meta_description || "",
      notes: bookmark.notes || "",
      tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
      is_read: Boolean(bookmark.is_read),
      created_at: bookmark.created_at,
      updated_at: bookmark.updated_at,
      kind: BOOKMARK_KIND.bookmark,
      ownership: BOOKMARK_OWNERSHIP.mine,
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
      public_stack_id: publicStack?.id || null,
      public_stack_status: publicStack?.status || PUBLIC_SHARE_STATUS.NOT_REQUESTED,
      public_stack_item_id: publicStackItem?.id || null,
      public_stack_item_status:
        publicStackItem?.status || PUBLIC_SHARE_STATUS.NOT_REQUESTED,
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
      tags: Array.isArray(listing.tags) ? listing.tags : [],
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      kind: BOOKMARK_KIND.public,
      ownership: BOOKMARK_OWNERSHIP.public,
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

  #toPublicStackViewModel(stack, resource, children = []) {
    return {
      id: `public-stack-${stack.id}`,
      public_stack_id: stack.id,
      resource_id: stack.resource_id,
      bookmark_id: stack.root_bookmark_id,
      url: resource?.canonical_url,
      normalized_url: resource?.normalized_url,
      page_title: stack.page_title || resource?.page_title || "",
      meta_description: stack.meta_description || resource?.meta_description || "",
      tags: Array.isArray(stack.tags) ? stack.tags : [],
      created_at: stack.created_at,
      updated_at: stack.updated_at,
      kind: BOOKMARK_KIND.publicStack,
      ownership: BOOKMARK_OWNERSHIP.public,
      can_toggle_read: false,
      can_edit: false,
      can_delete: false,
      can_save_copy: false,
      public_share_status: stack.status,
      public_rejection_code: stack.rejection_code || "",
      public_rejection_reason: stack.rejection_reason || "",
      is_public_listing_owner: false,
      is_public_resource: true,
      children,
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
      .select(RESOURCE_FIELDS)
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validateResourceRecord(data),
          "Received an invalid resource from the database.",
        )
      : null;
  }

  async findBookmarkByResourceId(resourceId, userId = null) {
    const targetUserId = userId || (await this.#requireUser()).id;

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select(BOOKMARK_FIELDS)
      .eq("user_id", targetUserId)
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validateBookmarkRecord(data),
          "Received an invalid bookmark from the database.",
        )
      : null;
  }

  async findApprovedPublicListing(resourceId) {
    const { data, error } = await this.#supabase
      .from("public_listings")
      .select(PUBLIC_LISTING_FIELDS)
      .eq("resource_id", resourceId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validatePublicListingRecord(data),
          "Received an invalid public listing from the database.",
        )
      : null;
  }

  async #findPublicListing(resourceId) {
    const { data, error } = await this.#supabase
      .from("public_listings")
      .select(PUBLIC_LISTING_FIELDS)
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validatePublicListingRecord(data),
          "Received an invalid public listing from the database.",
        )
      : null;
  }

  async #findPublicStackByRootBookmarkId(rootBookmarkId) {
    const { data, error } = await this.#supabase
      .from("public_stacks")
      .select(PUBLIC_STACK_FIELDS)
      .eq("root_bookmark_id", rootBookmarkId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validatePublicStackRecord(data),
          "Received an invalid public stack from the database.",
        )
      : null;
  }

  async #findPublicStackItemByBookmarkId(bookmarkId) {
    const { data, error } = await this.#supabase
      .from("public_stack_items")
      .select(PUBLIC_STACK_ITEM_FIELDS)
      .eq("bookmark_id", bookmarkId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? this.#requireValid(
          validatePublicStackItemRecord(data),
          "Received an invalid public stack item from the database.",
        )
      : null;
  }

  async #hasBookmarksForResource(resourceId) {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select("id")
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async #hasPublicListingForResource(resourceId) {
    const { data, error } = await this.#supabase
      .from("public_listings")
      .select("id")
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async #deleteRowById(table, id, failureMessage) {
    const { data, error } = await this.#supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(failureMessage);
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
    };

    const { data, error } = await this.#supabase
      .from("resources")
      .insert(resourcePayload)
      .select(RESOURCE_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    return this.#requireValid(
      validateResourceRecord(data),
      "Received an invalid resource from the database.",
    );
  }

  async #createBookmarkRow(resource, bookmark, userId, defaults = {}) {
    const bookmarkPayload = {
      user_id: userId,
      resource_id: resource.id,
      parent_id: bookmark.parent_id || null,
      notes: bookmark.notes || "",
      tags: bookmark.tags || defaults.tags || [],
      is_read: false,
      read_at: null,
      title_override: defaults.title_override || null,
      description_override: defaults.description_override || null,
    };

    const { data, error } = await this.#supabase
      .from("bookmarks")
      .insert(bookmarkPayload)
      .select(BOOKMARK_FIELDS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("You've already bookmarked this URL");
      }
      throw error;
    }

    return this.#requireValid(
      validateBookmarkRecord(data),
      "Received an invalid bookmark from the database.",
    );
  }

  async #upsertPublicStack(payload, existingStack = null) {
    if (existingStack) {
      const { data, error } = await this.#supabase
        .from("public_stacks")
        .update(payload)
        .eq("id", existingStack.id)
        .select(PUBLIC_STACK_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      return this.#requireValid(
        validatePublicStackRecord(data),
        "Received an invalid public stack from the database.",
      );
    }

    const { data, error } = await this.#supabase
      .from("public_stacks")
      .insert(payload)
      .select(PUBLIC_STACK_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    return this.#requireValid(
      validatePublicStackRecord(data),
      "Received an invalid public stack from the database.",
    );
  }

  async #upsertPublicStackItem(payload, existingItem = null) {
    if (existingItem) {
      const { data, error } = await this.#supabase
        .from("public_stack_items")
        .update(payload)
        .eq("id", existingItem.id)
        .select(PUBLIC_STACK_ITEM_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      return this.#requireValid(
        validatePublicStackItemRecord(data),
        "Received an invalid public stack item from the database.",
      );
    }

    const { data, error } = await this.#supabase
      .from("public_stack_items")
      .insert(payload)
      .select(PUBLIC_STACK_ITEM_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    return this.#requireValid(
      validatePublicStackItemRecord(data),
      "Received an invalid public stack item from the database.",
    );
  }

  async #getChildBookmarks(rootBookmarkId, userId) {
    const { data, error } = await this.#supabase
      .from("bookmarks")
      .select(BOOKMARK_FIELDS)
      .eq("user_id", userId)
      .eq("parent_id", rootBookmarkId);

    if (error) {
      throw error;
    }

    return this.#requireValid(
      validateBookmarkRecords(data || []),
      "Received invalid bookmarks from the database.",
    );
  }

  async #updateBookmarkParent(id, parentId) {
    const { error } = await this.#supabase
      .from("bookmarks")
      .update({ parent_id: parentId })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }
  }

  async #syncChildBookmarkIntoPublicStack(bookmark, publicStack, currentUserId, isAdmin) {
    const resourceMap = await this.#fetchResources([bookmark.resource_id]);
    const resource = resourceMap.get(bookmark.resource_id);
    const approvedListing = await this.findApprovedPublicListing(bookmark.resource_id);
    const existingItem = await this.#findPublicStackItemByBookmarkId(bookmark.id);
    const nextStatus = getInitialStackItemState({
      isAdmin,
      hasApprovedPublicListing: Boolean(approvedListing),
    });
    const payload = {
      public_stack_id: publicStack.id,
      bookmark_id: bookmark.id,
      resource_id: bookmark.resource_id,
      source_public_listing_id: approvedListing?.id || null,
      status: nextStatus,
      page_title: bookmark.title_override || resource?.page_title || "",
      meta_description:
        bookmark.description_override || resource?.meta_description || "",
      tags: bookmark.tags || [],
      display_order: bookmark.created_at
        ? Date.parse(bookmark.created_at)
        : Date.now(),
      rejection_code: null,
      rejection_reason: null,
      reviewed_at:
        nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? new Date().toISOString() : null,
      reviewed_by:
        nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? currentUserId : null,
    };

    return this.#upsertPublicStackItem(payload, existingItem);
  }

  async #hydrateBookmarks(bookmarks, currentUserId) {
    if (!bookmarks.length) {
      return [];
    }

    const resourceIds = [...new Set(bookmarks.map((bookmark) => bookmark.resource_id))];
    const bookmarkIds = bookmarks.map((bookmark) => bookmark.id);
    const [resources, publicListings, publicStacks, publicStackItems] = await Promise.all([
      this.#fetchResources(resourceIds),
      this.#fetchPublicListings(resourceIds, [
        PUBLIC_SHARE_STATUS.PENDING,
        PUBLIC_SHARE_STATUS.APPROVED,
        PUBLIC_SHARE_STATUS.REJECTED,
      ]),
      this.#fetchPublicStacksByRootIds(bookmarkIds, [
        PUBLIC_SHARE_STATUS.PENDING,
        PUBLIC_SHARE_STATUS.APPROVED,
        PUBLIC_SHARE_STATUS.REJECTED,
      ]),
      this.#fetchPublicStackItemsByBookmarkIds(bookmarkIds, [
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
        publicStacks.get(bookmark.id) || null,
        publicStackItems.get(bookmark.id) || null,
      ),
    );
  }

  /**
   * @param {BookmarkSort} [sortBy]
   */
  async getMyBookmarks(sortBy = BOOKMARK_SORT.newest) {
    const user = await this.#requireUser();
    const querySort = this.#usesAlphaSort(sortBy)
      ? BOOKMARK_SORT.newest
      : sortBy;

    let query = this.#supabase
      .from("bookmarks")
      .select(BOOKMARK_FIELDS)
      .eq("user_id", user.id);

    query = this.#applySort(query, querySort);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const bookmarks = this.#requireValid(
      validateBookmarkRecords(data || []),
      "Received invalid bookmarks from the database.",
    );

    const hydratedBookmarks = await this.#hydrateBookmarks(bookmarks, user.id);
    return this.#sortFeed(hydratedBookmarks, sortBy);
  }

  /**
   * @param {BookmarkSort} [sortBy]
   */
  async getTopLevel(sortBy = BOOKMARK_SORT.newest) {
    const bookmarks = await this.getMyBookmarks(sortBy);
    return bookmarks.filter((bookmark) => !bookmark.parent_id);
  }

  /**
   * @param {string} parentId
   * @param {BookmarkSort} [sortBy]
   */
  async getChildren(parentId, sortBy = BOOKMARK_SORT.newest) {
    const bookmarks = await this.getMyBookmarks(sortBy);
    return bookmarks.filter((bookmark) => bookmark.parent_id === parentId);
  }

  /**
   * @param {BookmarkSort} [sortBy]
   */
  async getPublicCatalog(sortBy = BOOKMARK_SORT.newest) {
    let query = this.#supabase
      .from("public_listings")
      .select(PUBLIC_LISTING_FIELDS)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED);

    query = this.#applySort(query, sortBy, "reviewed_at", "page_title");

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const listings = this.#requireValid(
      validatePublicListingRecords(data || []),
      "Received invalid public listings from the database.",
    );

    const standaloneResources = await this.#fetchResources(
      listings.map((listing) => listing.resource_id),
    );

    const standaloneEntries = listings.map((listing) =>
      this.#toPublicViewModel(listing, standaloneResources.get(listing.resource_id)),
    );

    let stackQuery = this.#supabase
      .from("public_stacks")
      .select(PUBLIC_STACK_FIELDS)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED);

    stackQuery = this.#applySort(stackQuery, sortBy, "reviewed_at", "page_title");

    const { data: stackData, error: stackError } = await stackQuery;

    if (stackError) {
      throw stackError;
    }

    const stacks = this.#requireValid(
      validatePublicStackRecords(stackData || []),
      "Received invalid public stacks from the database.",
    );

    if (!stacks.length) {
      return standaloneEntries;
    }

    const stackItems = await this.#fetchPublicStackItemsByStackIds(
      stacks.map((stack) => stack.id),
      [PUBLIC_SHARE_STATUS.APPROVED],
    );
    const stackChildResources = await this.#fetchResources(
      stackItems.map((item) => item.resource_id),
    );
    const stackRootResources = await this.#fetchResources(
      stacks.map((stack) => stack.resource_id),
    );
    const itemsByStackId = stackItems.reduce((map, item) => {
      if (!map.has(item.public_stack_id)) {
        map.set(item.public_stack_id, []);
      }
      map.get(item.public_stack_id).push(item);
      return map;
    }, new Map());

    const stackEntries = stacks.map((stack) => {
      const rootResource = stackRootResources.get(stack.resource_id);
      const children = (itemsByStackId.get(stack.id) || [])
        .sort((left, right) => left.display_order - right.display_order)
        .map((item) => {
          const childResource = stackChildResources.get(item.resource_id);
          return {
            id: `public-stack-item-${item.id}`,
            public_stack_item_id: item.id,
            public_stack_id: stack.id,
            resource_id: item.resource_id,
            url: childResource?.canonical_url,
            normalized_url: childResource?.normalized_url,
            page_title: item.page_title || childResource?.page_title || "",
            meta_description:
              item.meta_description || childResource?.meta_description || "",
            tags: Array.isArray(item.tags) ? item.tags : [],
            created_at: item.created_at,
            updated_at: item.updated_at,
            kind: BOOKMARK_KIND.public,
            ownership: BOOKMARK_OWNERSHIP.public,
            can_toggle_read: false,
            can_edit: false,
            can_delete: false,
            can_save_copy: Boolean(item.source_public_listing_id),
            public_share_status: item.status,
            public_listing_id: item.source_public_listing_id,
            is_public_listing_owner: false,
            is_public_resource: true,
          };
        });

      return this.#toPublicStackViewModel(stack, rootResource, children);
    });

    return this.#sortFeed([...standaloneEntries, ...stackEntries], sortBy);
  }

  /**
   * @param {BookmarkSort} [sortBy]
   */
  async getCombinedFeed(sortBy = BOOKMARK_SORT.newest) {
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
      .select(BOOKMARK_FIELDS)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }

    const bookmark = this.#requireValid(
      validateBookmarkRecord(data),
      "Received an invalid bookmark from the database.",
    );

    const hydrated = await this.#hydrateBookmarks([bookmark], user.id);
    return hydrated[0];
  }

  async create(bookmark) {
    const validationResult = validateCreateBookmarkInput(bookmark);
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(validationResult, "Invalid bookmark input."),
      );
    }

    const user = await this.#requireUser();
    const isAdmin = await this.#isAdmin(user.id);
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

    if (createdBookmark.parent_id) {
      const parentStack = await this.#findPublicStackByRootBookmarkId(createdBookmark.parent_id);
      if (parentStack?.status === PUBLIC_SHARE_STATUS.APPROVED) {
        await this.#syncChildBookmarkIntoPublicStack(
          createdBookmark,
          parentStack,
          user.id,
          isAdmin,
        );
      }
    }

    return this.getById(createdBookmark.id);
  }

  async addExistingPublicToLibrary({
    resourceId,
    publicListingId,
    notes = "",
    parentId = null,
  }) {
    const validationResult = validateAddExistingPublicBookmarkInput({
      resourceId,
      publicListingId,
      notes,
      parentId,
    });
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(
          validationResult,
          "Invalid public bookmark input.",
        ),
      );
    }

    const user = await this.#requireUser();
    const isAdmin = await this.#isAdmin(user.id);
    const duplicate = await this.findBookmarkByResourceId(resourceId, user.id);

    if (duplicate) {
      throw new Error("You've already bookmarked this URL");
    }

    const { data: listing, error: listingError } = await this.#supabase
      .from("public_listings")
      .select(PUBLIC_LISTING_FIELDS)
      .eq("id", publicListingId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .single();

    if (listingError) {
      throw listingError;
    }

    const { data: resource, error: resourceError } = await this.#supabase
      .from("resources")
      .select(RESOURCE_FIELDS)
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

    if (parentId) {
      const parentStack = await this.#findPublicStackByRootBookmarkId(parentId);
      if (parentStack?.status === PUBLIC_SHARE_STATUS.APPROVED) {
        await this.#syncChildBookmarkIntoPublicStack(
          bookmark,
          parentStack,
          user.id,
          isAdmin,
        );
      }
    }

    return this.getById(bookmark.id);
  }

  async update(id, updates) {
    const validationResult = validateUpdateBookmarkInput(updates);
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(validationResult, "Invalid bookmark update input."),
      );
    }

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
      .select("id")
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

    const updatedBookmark = this.#requireValid(
      validateBookmarkReference(data),
      "Received an invalid bookmark update response from the database.",
    );

    return this.getById(updatedBookmark.id);
  }

  async delete(id) {
    const bookmark = await this.getById(id);
    const listing = await this.#findPublicListing(bookmark.resource_id);
    const publicStack = await this.#findPublicStackByRootBookmarkId(id);
    const publicStackItem = await this.#findPublicStackItemByBookmarkId(id);

    if (listing?.submitted_by_bookmark_id === id) {
      await this.#deleteRowById(
        "public_listings",
        listing.id,
        "Failed to delete the public listing tied to this bookmark.",
      );
    }

    if (publicStack) {
      const stackItems = await this.#fetchPublicStackItemsByStackIds([publicStack.id]);
      for (const item of stackItems) {
        await this.#deleteRowById(
          "public_stack_items",
          item.id,
          "Failed to delete the public stack item tied to this bookmark.",
        );
      }

      await this.#deleteRowById(
        "public_stacks",
        publicStack.id,
        "Failed to delete the public stack tied to this bookmark.",
      );
    }

    if (publicStackItem) {
      await this.#deleteRowById(
        "public_stack_items",
        publicStackItem.id,
        "Failed to delete the public stack item tied to this bookmark.",
      );
    }

    await this.#deleteRowById(
      "bookmarks",
      id,
      "Failed to delete this bookmark.",
    );

    const [hasBookmarks, hasPublicListing] = await Promise.all([
      this.#hasBookmarksForResource(bookmark.resource_id),
      this.#hasPublicListingForResource(bookmark.resource_id),
    ]);

    if (!hasBookmarks && !hasPublicListing) {
      await this.#deleteRowById(
        "resources",
        bookmark.resource_id,
        "Failed to delete the orphaned resource tied to this bookmark.",
      );
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
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    const updatedBookmark = this.#requireValid(
      validateBookmarkReference(data),
      "Received an invalid bookmark update response from the database.",
    );

    return this.getById(updatedBookmark.id);
  }

  async requestPublicShare(bookmarkId) {
    const user = await this.#requireUser();
    const bookmark = await this.getById(bookmarkId);
    const isAdmin = await this.#isAdmin(user.id);

    if (bookmark.parent_id) {
      throw new Error("Only top-level bookmarks can be submitted publicly");
    }

    const approvedDuplicate = await this.findApprovedPublicListing(bookmark.resource_id);
    if (approvedDuplicate && approvedDuplicate.submitted_by_user_id !== user.id) {
      throw new Error("This link is already in the public catalog");
    }

    const existingListing = await this.#findPublicListing(bookmark.resource_id);
    const nextStatus = getInitialSubmissionState({ isAdmin });
    const now = new Date().toISOString();
    const payload = {
      resource_id: bookmark.resource_id,
      submitted_by_user_id: user.id,
      submitted_by_bookmark_id: bookmark.id,
      status: nextStatus,
      page_title: bookmark.page_title,
      meta_description: bookmark.meta_description,
      tags: bookmark.tags || [],
      rejection_code: null,
      rejection_reason: null,
      reviewed_at: nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? now : null,
      reviewed_by: nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? user.id : null,
    };

    let listing;

    if (existingListing) {
      const { data, error } = await this.#supabase
        .from("public_listings")
        .update(payload)
        .eq("id", existingListing.id)
        .select(PUBLIC_LISTING_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      listing = this.#requireValid(
        validatePublicListingRecord(data),
        "Received an invalid public listing from the database.",
      );
    } else {
      const { data, error } = await this.#supabase
        .from("public_listings")
        .insert(payload)
        .select(PUBLIC_LISTING_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      listing = this.#requireValid(
        validatePublicListingRecord(data),
        "Received an invalid public listing from the database.",
      );
    }

    return listing;
  }

  async submitStackForPublication(bookmarkId) {
    const validationResult = validateSubmitPublicStackInput({ bookmarkId });
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(validationResult, "Invalid stack submission input."),
      );
    }

    const user = await this.#requireUser();
    const rootBookmark = await this.getById(bookmarkId);
    const isAdmin = await this.#isAdmin(user.id);

    if (rootBookmark.parent_id) {
      throw new Error("Only top-level bookmarks can be submitted as a public stack");
    }

    const children = await this.#getChildBookmarks(bookmarkId, user.id);
    const existingStack = await this.#findPublicStackByRootBookmarkId(bookmarkId);
    const nextStatus = getInitialSubmissionState({ isAdmin });
    const now = new Date().toISOString();
    const stackPayload = {
      root_bookmark_id: rootBookmark.id,
      resource_id: rootBookmark.resource_id,
      owner_user_id: user.id,
      status: nextStatus,
      page_title: rootBookmark.page_title,
      meta_description: rootBookmark.meta_description,
      tags: rootBookmark.tags || [],
      rejection_code: null,
      rejection_reason: null,
      reviewed_at: nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? now : null,
      reviewed_by: nextStatus === PUBLIC_SHARE_STATUS.APPROVED ? user.id : null,
    };

    const stack = await this.#upsertPublicStack(stackPayload, existingStack);

    for (const child of children) {
      await this.#syncChildBookmarkIntoPublicStack(child, stack, user.id, isAdmin);
    }

    return stack;
  }

  async resolveRootDeletion(id, { strategy, promoteChildId = null }) {
    const validationResult = validateResolveRootDeletionInput({
      strategy,
      promoteChildId,
    });
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(validationResult, "Invalid stack deletion input."),
      );
    }

    const rootBookmark = await this.getById(id);
    const user = await this.#requireUser();
    let deletionState = transitionStackDeletionState(
      STACK_DELETION_STATE.idle,
      STACK_DELETION_EVENT.begin,
    );

    if (rootBookmark.parent_id) {
      throw new Error("Only top-level stack roots can use stack deletion strategies");
    }

    const children = await this.#getChildBookmarks(id, user.id);
    const publicStack = await this.#findPublicStackByRootBookmarkId(id);
    deletionState = transitionStackDeletionState(
      deletionState,
      STACK_DELETION_EVENT.selectStrategy,
      { strategy },
    );

    if (strategy === "delete_all") {
      for (const child of children) {
        await this.delete(child.id);
      }
      await this.delete(id);
      transitionStackDeletionState(deletionState, STACK_DELETION_EVENT.complete);
      return;
    }

    if (strategy === "unstack_children") {
      if (publicStack) {
        const stackItems = await this.#fetchPublicStackItemsByStackIds([publicStack.id]);
        for (const item of stackItems) {
          await this.#deleteRowById(
            "public_stack_items",
            item.id,
            "Failed to delete the public stack item tied to this bookmark.",
          );
        }
        await this.#deleteRowById(
          "public_stacks",
          publicStack.id,
          "Failed to delete the public stack tied to this bookmark.",
        );
      }

      for (const child of children) {
        await this.#updateBookmarkParent(child.id, null);
      }

      await this.delete(id);
      transitionStackDeletionState(deletionState, STACK_DELETION_EVENT.complete);
      return;
    }

    const promotedChild = children.find((child) => child.id === promoteChildId);
    if (!promotedChild) {
      throw new Error("Choose a valid child to promote before deleting this stack root.");
    }
    deletionState = transitionStackDeletionState(
      deletionState,
      STACK_DELETION_EVENT.selectChild,
    );

    await this.#updateBookmarkParent(promotedChild.id, null);

    for (const child of children) {
      if (child.id === promoteChildId) {
        continue;
      }

      await this.#updateBookmarkParent(child.id, promoteChildId);
    }

    if (publicStack) {
      const promotedItem = await this.#findPublicStackItemByBookmarkId(promoteChildId);
      if (promotedItem) {
        await this.#deleteRowById(
          "public_stack_items",
          promotedItem.id,
          "Failed to delete the public stack item for the promoted child.",
        );
      }

      await this.#upsertPublicStack(
        {
          ...publicStack,
          root_bookmark_id: promoteChildId,
          resource_id: promotedChild.resource_id,
          owner_user_id: user.id,
          status: PUBLIC_SHARE_STATUS.PENDING,
          rejection_code: null,
          rejection_reason: null,
          reviewed_at: null,
          reviewed_by: null,
        },
        publicStack,
      );
    }

    await this.delete(id);
    transitionStackDeletionState(deletionState, STACK_DELETION_EVENT.complete);
  }

  /**
   * @param {BookmarkSort} [sortBy]
   */
  async getPendingPublicListings(sortBy = BOOKMARK_SORT.newest) {
    const { data, error } = await this.#applySort(
      this.#supabase
        .from("public_listings")
        .select(PUBLIC_LISTING_FIELDS)
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

    const listings = this.#requireValid(
      validatePublicListingRecords(data),
      "Received invalid public listings from the database.",
    );

    const resources = await this.#fetchResources(
      listings.map((listing) => listing.resource_id),
    );

    return listings.map((listing) => ({
      ...this.#toPublicViewModel(listing, resources.get(listing.resource_id)),
      submitted_by_user_id: listing.submitted_by_user_id,
      submitted_by_bookmark_id: listing.submitted_by_bookmark_id,
      public_share_status: listing.status,
    }));
  }

  async getPendingPublicSubmissions(sortBy = BOOKMARK_SORT.newest) {
    const [listings, stacks, stackItems] = await Promise.all([
      this.getPendingPublicListings(sortBy),
      (async () => {
        const { data, error } = await this.#applySort(
          this.#supabase
            .from("public_stacks")
            .select(PUBLIC_STACK_FIELDS)
            .eq("status", PUBLIC_SHARE_STATUS.PENDING),
          sortBy,
          "created_at",
          "page_title",
        );

        if (error) {
          throw error;
        }

        return this.#requireValid(
          validatePublicStackRecords(data || []),
          "Received invalid public stacks from the database.",
        );
      })(),
      (async () => {
        const { data, error } = await this.#applySort(
          this.#supabase
            .from("public_stack_items")
            .select(PUBLIC_STACK_ITEM_FIELDS)
            .eq("status", PUBLIC_SHARE_STATUS.PENDING),
          sortBy,
          "created_at",
          "page_title",
        );

        if (error) {
          throw error;
        }

        return this.#requireValid(
          validatePublicStackItemRecords(data || []),
          "Received invalid public stack items from the database.",
        );
      })(),
    ]);

    if (!stacks.length && !stackItems.length) {
      return listings.map((listing) => ({
        id: listing.public_listing_id,
        review_kind: "public_listing",
        url: listing.url,
        page_title: listing.page_title,
        meta_description: listing.meta_description,
        tags: listing.tags,
      }));
    }

    const stackAndItemResources = await this.#fetchResources(
      [
        ...new Set([
          ...stacks.map((stack) => stack.resource_id),
          ...stackItems.map((item) => item.resource_id),
        ]),
      ],
    );

    return [
      ...listings.map((listing) => ({
        id: listing.public_listing_id,
        review_kind: "public_listing",
        url: listing.url,
        page_title: listing.page_title,
        meta_description: listing.meta_description,
        tags: listing.tags,
      })),
      ...stacks.map((stack) => {
        const resource = stackAndItemResources.get(stack.resource_id);
        return {
          id: stack.id,
          review_kind: "public_stack",
          url: resource?.canonical_url || "",
          page_title: stack.page_title,
          meta_description: stack.meta_description,
          tags: stack.tags,
        };
      }),
      ...stackItems.map((item) => {
        const resource = stackAndItemResources.get(item.resource_id);
        return {
          id: item.id,
          review_kind: "public_stack_item",
          url: resource?.canonical_url || "",
          page_title: item.page_title,
          meta_description: item.meta_description,
          tags: item.tags,
        };
      }),
    ];
  }

  async reviewPublicShare(id, { decision, rejectionCode = null, rejectionReason = "" }) {
    const validationResult = validateReviewPublicShareInput({
      decision,
      rejectionCode,
      rejectionReason,
    });
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(
          validationResult,
          "Invalid public review input.",
        ),
      );
    }

    const reviewer = await this.#requireUser();
    /** @type {ReviewDecision} */
    const typedDecision = decision;
    const status =
      typedDecision === REVIEW_DECISION.approve
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
      .select(PUBLIC_LISTING_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    return this.#requireValid(
      validatePublicListingRecord(data),
      "Received an invalid public listing from the database.",
    );
  }

  async reviewPublicSubmission(
    reviewKind,
    id,
    { decision, rejectionCode = null, rejectionReason = "" },
  ) {
    const targetConfig = getReviewTargetConfig(reviewKind);

    if (targetConfig.reviewKind === PUBLICATION_REVIEW_KIND.publicListing) {
      return this.reviewPublicShare(id, { decision, rejectionCode, rejectionReason });
    }

    const validationResult = validateReviewPublicShareInput({
      decision,
      rejectionCode,
      rejectionReason,
    });
    if (!validationResult.success) {
      throw new Error(
        getValidationMessage(
          validationResult,
          "Invalid public review input.",
        ),
      );
    }

    const reviewer = await this.#requireUser();
    const status = getReviewedState(decision);
    const targetTable = targetConfig.table;
    const targetFields =
      targetConfig.reviewKind === PUBLICATION_REVIEW_KIND.publicStack
        ? PUBLIC_STACK_FIELDS
        : PUBLIC_STACK_ITEM_FIELDS;

    const { data, error } = await this.#supabase
      .from(targetTable)
      .update({
        status,
        rejection_code: status === PUBLIC_SHARE_STATUS.REJECTED ? rejectionCode : null,
        rejection_reason:
          status === PUBLIC_SHARE_STATUS.REJECTED ? rejectionReason : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer.id,
      })
      .eq("id", id)
      .select(targetFields)
      .single();

    if (error) {
      throw error;
    }

    return targetConfig.reviewKind === PUBLICATION_REVIEW_KIND.publicStack
      ? this.#requireValid(
          validatePublicStackRecord(data),
          "Received an invalid public stack from the database.",
        )
      : this.#requireValid(
          validatePublicStackItemRecord(data),
          "Received an invalid public stack item from the database.",
        );
  }

  async savePublicCopy(publicListingId) {
    const { data: listing, error } = await this.#supabase
      .from("public_listings")
      .select("id, resource_id")
      .eq("id", publicListingId)
      .eq("status", PUBLIC_SHARE_STATUS.APPROVED)
      .single();

    if (error) {
      throw error;
    }

    const publicListing = this.#requireValid(
      validatePublicListingReference(listing),
      "Received an invalid public listing from the database.",
    );

    return this.addExistingPublicToLibrary({
      resourceId: publicListing.resource_id,
      publicListingId,
    });
  }

  async fetchAll() {
    return this.getMyBookmarks();
  }
}
