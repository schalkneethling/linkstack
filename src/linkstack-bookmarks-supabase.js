// @ts-check
import { supabase } from "./lib/supabase.js";
import {
  BookmarksService,
  PUBLIC_SHARE_STATUS,
} from "./services/bookmarks.service.js";

export class LinkStackBookmarks extends HTMLElement {
  static #selectors = {
    bookmarksContainer: "#bookmarks-container",
    bookmarksEntryTmpl: "#bookmarks-entry-tmpl",
    bookmarkChildTmpl: "#bookmark-child-tmpl",
    noBookmarksTmpl: "#no-bookmarks-tmpl",
    skeletonLoaderTmpl: "#skeleton-loader-tmpl",
    searchInput: "#search-input",
    clearSearchButton: "#clear-search",
    searchResultsInfo: ".search-results-info",
    sortSelect: "#sort-select",
    filterButtons: ".filter-button",
    scopeSelect: "#scope-select",
    filterContainer: ".filter-controls-container",
  };

  #elements = {
    /** @type {HTMLElement | null} */
    bookmarksContainer: null,
    /** @type {Element | null} */
    linkstackEditDialog: null,
    /** @type {HTMLInputElement | null} */
    searchInput: null,
    /** @type {HTMLButtonElement | null} */
    clearSearchButton: null,
    /** @type {HTMLElement | null} */
    searchResultsInfo: null,
    /** @type {HTMLSelectElement | null} */
    sortSelect: null,
    /** @type {NodeListOf<HTMLButtonElement> | null} */
    filterButtons: null,
    /** @type {HTMLSelectElement | null} */
    scopeSelect: null,
    /** @type {HTMLElement | null} */
    filterContainer: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #renderPromise = null;
  #isInitialLoad = true;
  #searchQuery = "";
  #sortBy = "newest";
  #filterBy = "unread";
  #scope = "public";
  #isAuthenticated = false;
  #searchDebounceTimer = null;
  #boundHandlers = {
    onBookmarkCreated: null,
    onBookmarkUpdated: null,
    onAuthStateChanged: null,
  };

  connectedCallback() {
    this.#init();
  }

  disconnectedCallback() {
    if (this.#boundHandlers.onBookmarkCreated) {
      window.removeEventListener(
        "bookmark-created",
        this.#boundHandlers.onBookmarkCreated,
      );
    }
    if (this.#boundHandlers.onBookmarkUpdated) {
      window.removeEventListener(
        "bookmark-updated",
        this.#boundHandlers.onBookmarkUpdated,
      );
    }
    if (this.#boundHandlers.onAuthStateChanged) {
      window.removeEventListener(
        "auth-state-changed",
        this.#boundHandlers.onAuthStateChanged,
      );
    }
  }

  async #init() {
    this.#elements.bookmarksContainer = this.querySelector(
      LinkStackBookmarks.#selectors.bookmarksContainer,
    );
    this.#elements.linkstackEditDialog = document.querySelector(
      "linkstack-edit-dialog",
    );
    this.#elements.searchInput = document.querySelector(
      LinkStackBookmarks.#selectors.searchInput,
    );
    this.#elements.clearSearchButton = document.querySelector(
      LinkStackBookmarks.#selectors.clearSearchButton,
    );
    this.#elements.searchResultsInfo = document.querySelector(
      LinkStackBookmarks.#selectors.searchResultsInfo,
    );
    this.#elements.sortSelect = document.querySelector(
      LinkStackBookmarks.#selectors.sortSelect,
    );
    this.#elements.filterButtons = document.querySelectorAll(
      LinkStackBookmarks.#selectors.filterButtons,
    );
    this.#elements.scopeSelect = document.querySelector(
      LinkStackBookmarks.#selectors.scopeSelect,
    );
    this.#elements.filterContainer = document.querySelector(
      LinkStackBookmarks.#selectors.filterContainer,
    );

    const params = new URLSearchParams(window.location.search);
    this.#searchQuery = params.get("search") || "";
    this.#sortBy = params.get("sort") || localStorage.getItem("linkstack:sortBy") || "newest";
    this.#filterBy =
      params.get("filter") || localStorage.getItem("linkstack:filterBy") || "unread";

    if (this.#elements.searchInput) {
      this.#elements.searchInput.value = this.#searchQuery;
    }
    if (this.#elements.clearSearchButton) {
      this.#elements.clearSearchButton.hidden = !this.#searchQuery;
    }
    if (this.#elements.sortSelect) {
      this.#elements.sortSelect.value = this.#sortBy;
    }

    this.#setActiveFilterButton(this.#filterBy);
    this.#addEventListeners();
    this.#setupSearch();
    this.#setupSort();
    this.#setupFilter();
    this.#setupScope();
    this.#syncFilterVisibility();
    await this.#renderBookmarks();
  }

  #addEventListeners() {
    const { bookmarksContainer } = this.#elements;

    this.#boundHandlers.onBookmarkCreated = async () => {
      await this.#renderBookmarks();
    };

    this.#boundHandlers.onBookmarkUpdated = async () => {
      await this.#renderBookmarks();
    };

    this.#boundHandlers.onAuthStateChanged = async (event) => {
      const authEvent =
        /** @type {CustomEvent<{ isAuthenticated?: boolean, scope?: string }>} */ (
          event
        );
      this.#isAuthenticated = Boolean(authEvent.detail?.isAuthenticated);
      this.#scope =
        authEvent.detail?.scope || (this.#isAuthenticated ? "mine" : "public");
      this.#syncFilterVisibility();
      await this.#renderBookmarks();
    };

    window.addEventListener(
      "bookmark-created",
      this.#boundHandlers.onBookmarkCreated,
    );
    window.addEventListener(
      "bookmark-updated",
      this.#boundHandlers.onBookmarkUpdated,
    );
    window.addEventListener(
      "auth-state-changed",
      this.#boundHandlers.onAuthStateChanged,
    );

    bookmarksContainer.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      const stackToggle = target.closest(".stack-toggle");
      if (stackToggle) {
        this.#toggleStack(stackToggle);
        return;
      }

      const readToggle = /** @type {HTMLButtonElement | null} */ (
        target.closest("#toggle-read-status")
      );
      if (readToggle && !readToggle.classList.contains("hidden")) {
        await this.#toggleReadStatus(readToggle.dataset.id, readToggle);
        return;
      }

      const savePublicCopy = /** @type {HTMLButtonElement | null} */ (
        target.closest("#save-public-copy")
      );
      if (savePublicCopy && !savePublicCopy.classList.contains("hidden")) {
        await this.#savePublicCopy(savePublicCopy.dataset.publicListingId);
        return;
      }

      const requestPublicShare = target.closest("#request-public-share");
      if (
        requestPublicShare &&
        !requestPublicShare.classList.contains("hidden")
      ) {
        const contextMenu =
          /** @type {(HTMLElement & { hidePopover?: () => void }) | null} */ (
            requestPublicShare.closest(".context-menu")
          );
        contextMenu?.hidePopover?.();
        await this.#requestPublicShare(
          /** @type {HTMLElement} */ (requestPublicShare).dataset.id,
        );
        return;
      }

      if (target.closest(".context-menu-trigger")) {
        return;
      }

      if (target.id === "delete-bookmark") {
        const contextMenu =
          /** @type {(HTMLElement & { hidePopover?: () => void }) | null} */ (
            target.closest(".context-menu")
          );
        contextMenu?.hidePopover?.();
        await this.#deleteBookmark(target.dataset.id);
      }

      if (target.id === "edit-bookmark") {
        const contextMenu =
          /** @type {(HTMLElement & { hidePopover?: () => void }) | null} */ (
            target.closest(".context-menu")
          );
        contextMenu?.hidePopover?.();
        this.#elements.linkstackEditDialog?.dispatchEvent(
          new CustomEvent("edit-bookmark", {
            detail: { id: target.dataset.id },
          }),
        );
      }
    });
  }

  #setupSearch() {
    const { searchInput, clearSearchButton } = this.#elements;

    if (!searchInput) {
      return;
    }

    searchInput.addEventListener("input", (event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      const query = target.value.trim();

      if (clearSearchButton) {
        clearSearchButton.hidden = !query;
      }

      clearTimeout(this.#searchDebounceTimer);
      this.#searchDebounceTimer = setTimeout(async () => {
        this.#searchQuery = query;
        this.#updateUrlParam("search", query);
        await this.#renderBookmarks();
      }, 300);
    });

    clearSearchButton?.addEventListener("click", async () => {
      this.#searchQuery = "";
      searchInput.value = "";
      clearSearchButton.hidden = true;
      this.#updateUrlParam("search", "");
      await this.#renderBookmarks();
    });
  }

  #setupSort() {
    this.#elements.sortSelect?.addEventListener("change", async (event) => {
      const target = /** @type {HTMLSelectElement} */ (event.target);
      this.#sortBy = target.value;
      localStorage.setItem("linkstack:sortBy", this.#sortBy);
      this.#updateUrlParam("sort", this.#sortBy === "newest" ? "" : this.#sortBy);
      await this.#renderBookmarks();
    });
  }

  #setupFilter() {
    this.#elements.filterButtons?.forEach((button) => {
      button.addEventListener("click", async () => {
        this.#filterBy = button.dataset.filter;
        this.#setActiveFilterButton(this.#filterBy);
        localStorage.setItem("linkstack:filterBy", this.#filterBy);
        this.#updateUrlParam("filter", this.#filterBy === "all" ? "" : this.#filterBy);
        await this.#renderBookmarks();
      });
    });
  }

  #setupScope() {
    if (this.#elements.scopeSelect) {
      this.#scope = this.#elements.scopeSelect.value;
    }
  }

  #setActiveFilterButton(filterBy) {
    this.#elements.filterButtons?.forEach((button) => {
      const isActive = button.dataset.filter === filterBy;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  #syncFilterVisibility() {
    const showReadFilters = this.#isAuthenticated && this.#scope === "mine";
    this.#elements.filterContainer?.classList.toggle("hidden", !showReadFilters);
  }

  #updateUrlParam(key, value) {
    const url = new URL(window.location.href);

    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }

    window.history.replaceState({}, "", url);
  }

  #toggleStack(toggleButton) {
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
    const stackChildren = toggleButton.nextElementSibling;
    const stackLabel = toggleButton.querySelector(".stack-label");

    toggleButton.setAttribute("aria-expanded", String(!isExpanded));
    stackChildren?.classList.toggle("hidden", isExpanded);

    if (stackLabel) {
      stackLabel.textContent = isExpanded ? "Show stack" : "Hide stack";
    }
  }

  #showNoBookmarks(message = "Why not add your first?") {
    const tmpl = /** @type {HTMLTemplateElement | null} */ (
      this.querySelector(LinkStackBookmarks.#selectors.noBookmarksTmpl)
    );
    if (!tmpl || !this.#elements.bookmarksContainer) {
      return;
    }
    const fragment = /** @type {DocumentFragment} */ (tmpl.content.cloneNode(true));
    const description = fragment.querySelector(".text-medium");
    if (description) {
      description.textContent = message;
    }

    this.#elements.bookmarksContainer.innerHTML = "";
    this.#elements.bookmarksContainer.append(fragment);
  }

  #showSkeletonLoader() {
    const tmpl = /** @type {HTMLTemplateElement | null} */ (
      this.querySelector(LinkStackBookmarks.#selectors.skeletonLoaderTmpl)
    );
    if (!tmpl || !this.#elements.bookmarksContainer) {
      return;
    }
    const fragment = /** @type {DocumentFragment} */ (tmpl.content.cloneNode(true));
    this.#elements.bookmarksContainer.innerHTML = "";
    this.#elements.bookmarksContainer.append(fragment);
  }

  #filterBookmarks(bookmarks) {
    let filtered = bookmarks;

    if (this.#scope === "mine") {
      if (this.#filterBy === "read") {
        filtered = filtered.filter((bookmark) => bookmark.is_read);
      } else if (this.#filterBy === "unread") {
        filtered = filtered.filter((bookmark) => !bookmark.is_read);
      }
    }

    if (!this.#searchQuery.trim()) {
      return filtered;
    }

    const lowerQuery = this.#searchQuery.toLowerCase();
    return filtered.filter((bookmark) => {
      const haystacks = [
        bookmark.page_title,
        bookmark.meta_description,
        bookmark.url,
        bookmark.notes,
        ...(bookmark.tags || []),
      ];

      return haystacks.some((value) =>
        (value || "").toLowerCase().includes(lowerQuery),
      );
    });
  }

  #updateSearchResultsInfo(filteredCount, totalCount) {
    if (!this.#elements.searchResultsInfo) {
      return;
    }

    if (this.#searchQuery && filteredCount !== totalCount) {
      this.#elements.searchResultsInfo.textContent = `Showing ${filteredCount} of ${totalCount} bookmarks`;
    } else {
      this.#elements.searchResultsInfo.textContent = "";
    }
  }

  #renderTags(container, tags) {
    container.innerHTML = "";

    if (!tags?.length) {
      return;
    }

    tags.slice(0, 3).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      container.appendChild(chip);
    });

    if (tags.length > 3) {
      const overflow = document.createElement("span");
      overflow.className = "tag-overflow";
      overflow.textContent = `+${tags.length - 3} more`;
      container.appendChild(overflow);
    }
  }

  #renderStatus(entry, bookmark) {
    const statusContainer =
      /** @type {HTMLElement | null} */ (
        entry.querySelector(".bookmark-public-status")
      );
    const statusTag = statusContainer?.querySelector(".tag");
    const message =
      /** @type {HTMLElement | null} */ (
        entry.querySelector(".bookmark-public-message")
      );

    if (!statusContainer || !statusTag || !message) {
      return;
    }

    statusContainer.classList.add("hidden");
    message.classList.add("hidden");
    message.textContent = "";

    if (bookmark.kind !== "bookmark") {
      return;
    }

    const status = bookmark.public_share_status;
    if (status === PUBLIC_SHARE_STATUS.NOT_REQUESTED) {
      return;
    }

    const labels = {
      [PUBLIC_SHARE_STATUS.PENDING]: "Pending review",
      [PUBLIC_SHARE_STATUS.APPROVED]: bookmark.is_public_listing_owner
        ? "Publicly listed"
        : "Already public",
      [PUBLIC_SHARE_STATUS.REJECTED]: "Public listing rejected",
    };

    statusTag.textContent = labels[status] || status;
    statusContainer.classList.remove("hidden");

    if (status === PUBLIC_SHARE_STATUS.REJECTED && bookmark.public_rejection_reason) {
      message.textContent = bookmark.public_rejection_reason;
      message.classList.remove("hidden");
    }
  }

  #configureActions(entry, bookmark) {
    const readToggle = /** @type {HTMLButtonElement | null} */ (
      entry.querySelector("#toggle-read-status")
    );
    const savePublicCopy = /** @type {HTMLButtonElement | null} */ (
      entry.querySelector("#save-public-copy")
    );
    const contextMenuTrigger = /** @type {HTMLElement | null} */ (
      entry.querySelector(".context-menu-trigger")
    );
    const contextMenu = /** @type {HTMLElement | null} */ (
      entry.querySelector(".context-menu")
    );
    const requestPublicShare = /** @type {HTMLButtonElement | null} */ (
      entry.querySelector("#request-public-share")
    );
    const deleteButton = /** @type {HTMLButtonElement | null} */ (
      entry.querySelector("#delete-bookmark")
    );
    const editButton = /** @type {HTMLButtonElement | null} */ (
      entry.querySelector("#edit-bookmark")
    );

    if (
      !readToggle ||
      !savePublicCopy ||
      !contextMenuTrigger ||
      !contextMenu ||
      !requestPublicShare ||
      !deleteButton ||
      !editButton
    ) {
      return;
    }

    if (bookmark.kind === "public") {
      readToggle.classList.add("hidden");
      contextMenuTrigger.classList.add("hidden");
      contextMenu.classList.add("hidden");
      if (this.#isAuthenticated) {
        savePublicCopy.classList.remove("hidden");
        savePublicCopy.dataset.publicListingId = bookmark.public_listing_id;
      } else {
        savePublicCopy.classList.add("hidden");
      }
      return;
    }

    savePublicCopy.classList.add("hidden");
    readToggle.dataset.id = bookmark.id;
    readToggle.dataset.isRead = String(bookmark.is_read);
    readToggle.querySelector(".read-text").textContent = bookmark.is_read
      ? "Mark as Unread"
      : "Mark as Read";

    deleteButton.dataset.id = bookmark.id;
    editButton.dataset.id = bookmark.id;

    const showRequestPublic =
      !bookmark.parent_id &&
      bookmark.public_share_status !== PUBLIC_SHARE_STATUS.PENDING &&
      !(bookmark.public_share_status === PUBLIC_SHARE_STATUS.APPROVED && !bookmark.is_public_listing_owner);

    requestPublicShare.classList.toggle("hidden", !showRequestPublic);
    requestPublicShare.dataset.id = bookmark.id;

    if (bookmark.public_share_status === PUBLIC_SHARE_STATUS.REJECTED) {
      requestPublicShare.textContent = "Resubmit Public Listing";
    } else if (bookmark.public_share_status === PUBLIC_SHARE_STATUS.APPROVED) {
      requestPublicShare.textContent = "Update Public Listing";
    } else {
      requestPublicShare.textContent = "Request Public Listing";
    }
  }

  async #renderEntry(template, bookmark, children = []) {
    const templateElement = /** @type {HTMLTemplateElement} */ (template);
    const fragment = /** @type {DocumentFragment} */ (
      templateElement.content.cloneNode(true)
    );
    const img = /** @type {HTMLImageElement | null} */ (
      fragment.querySelector(".bookmark-img")
    );
    const link = /** @type {HTMLAnchorElement | null} */ (
      fragment.querySelector(".bookmark-link")
    );
    const title = /** @type {HTMLElement | null} */ (
      link?.querySelector(".bookmark-title") || null
    );
    const description = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".bookmark-description")
    );
    const notesContainer = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".bookmark-notes")
    );
    const notesContent = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".notes-content")
    );
    const tagsContainer = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".bookmark-tags")
    );
    const contextTrigger = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".context-menu-trigger")
    );
    const contextMenu = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".context-menu")
    );

    if (
      !link ||
      !title ||
      !description ||
      !notesContainer ||
      !notesContent ||
      !tagsContainer ||
      !contextTrigger ||
      !contextMenu
    ) {
      throw new Error("Bookmark template is missing required elements");
    }

    if (img) {
      img.src = bookmark.preview_img || "../assets/linkstack-fallback.webp";
    }

    link.href = bookmark.url;
    title.textContent = bookmark.page_title;
    description.textContent = bookmark.meta_description || "";
    this.#renderTags(tagsContainer, bookmark.tags);
    this.#renderStatus(fragment, bookmark);

    if (bookmark.notes) {
      notesContent.textContent = bookmark.notes;
      notesContainer.classList.remove("hidden");
    }

    const entry =
      /** @type {HTMLElement | null} */ (
        fragment.querySelector(".bookmark-entry") ||
          fragment.querySelector(".bookmark-child")
      );
    if (!entry) {
      throw new Error("Bookmark entry root not found");
    }
    entry.id = `bookmark-entry-${bookmark.id}`;

    if (bookmark.is_read) {
      entry.classList.add("read");
    }

    const contextMenuId = `context-menu-${bookmark.id}`;
    contextMenu.id = contextMenuId;
    contextTrigger.setAttribute("popovertarget", contextMenuId);

    this.#configureActions(fragment, bookmark);

    if (children.length && fragment.querySelector(".stack-toggle")) {
      const stackToggle = fragment.querySelector(".stack-toggle");
      const stackChildren = fragment.querySelector(".stack-children");
      if (!stackToggle || !stackChildren) {
        return fragment;
      }
      stackToggle.classList.remove("hidden");

      for (const child of children) {
        const childEntry = await this.#renderEntry(
          this.querySelector(LinkStackBookmarks.#selectors.bookmarkChildTmpl),
          child,
          [],
        );
        stackChildren.appendChild(childEntry);
      }
    }

    return fragment;
  }

  async #deleteBookmark(id) {
    try {
      await this.#bookmarksService.delete(id);
      this.#showToast(
        "Bookmark deleted successfully",
        "success",
      );
      await this.#renderBookmarks();
    } catch (error) {
      console.info("Error deleting bookmark:", error);
      this.#showToast(
        "Failed to delete bookmark. Please try again.",
        "error",
      );
    }
  }

  async #toggleReadStatus(id, button) {
    const newStatus = button.dataset.isRead !== "true";

    try {
      await this.#bookmarksService.toggleReadStatus(id, newStatus);
      this.#showToast(
        `Marked as ${newStatus ? "read" : "unread"}`,
        "success",
      );
      await this.#renderBookmarks();
    } catch (error) {
      console.info("Error toggling read status:", error);
      this.#showToast(
        "Failed to update read status. Please try again.",
        "error",
      );
    }
  }

  async #savePublicCopy(publicListingId) {
    try {
      await this.#bookmarksService.savePublicCopy(publicListingId);
      this.#showToast(
        "Bookmark added to your library",
        "success",
      );
      window.dispatchEvent(new CustomEvent("bookmark-created"));
    } catch (error) {
      console.info("Error saving public bookmark:", error);
      this.#showToast(
        error.message || "Failed to save bookmark.",
        "error",
      );
    }
  }

  async #requestPublicShare(id) {
    try {
      await this.#bookmarksService.requestPublicShare(id);
      this.#showToast(
        "Bookmark submitted for public review",
        "success",
      );
      window.dispatchEvent(new CustomEvent("bookmark-updated"));
    } catch (error) {
      console.info("Error requesting public share:", error);
      this.#showToast(
        error.message || "Failed to submit bookmark for review.",
        "error",
      );
    }
  }

  async #renderBookmarks() {
    const previousRender = this.#renderPromise;

    this.#renderPromise = (async () => {
      if (previousRender) {
        await previousRender;
      }
      await this.#doRender();
    })();

    await this.#renderPromise;
  }

  async #doRender() {
    const bookmarksContainer = this.#elements.bookmarksContainer;
    const entryTmpl = this.querySelector(LinkStackBookmarks.#selectors.bookmarksEntryTmpl);

    if (!bookmarksContainer || !entryTmpl) {
      return;
    }

    if (this.#isInitialLoad) {
      this.#showSkeletonLoader();
    }

    try {
      let topLevel = [];
      let children = new Map();

      if (!this.#isAuthenticated || this.#scope === "public") {
        topLevel = await this.#bookmarksService.getPublicCatalog(this.#sortBy);
      } else {
        const myBookmarks = await this.#bookmarksService.getMyBookmarks(this.#sortBy);
        children = myBookmarks.reduce((map, bookmark) => {
          if (bookmark.parent_id) {
            if (!map.has(bookmark.parent_id)) {
              map.set(bookmark.parent_id, []);
            }
            map.get(bookmark.parent_id).push(bookmark);
          }
          return map;
        }, /** @type {Map<string, Array<any>>} */ (new Map()));

        const topLevelBookmarks = myBookmarks.filter((bookmark) => !bookmark.parent_id);

        if (this.#scope === "all") {
          const publicCatalog = await this.#bookmarksService.getPublicCatalog(this.#sortBy);
          const ownedResourceIds = new Set(
            myBookmarks.map((bookmark) => bookmark.resource_id),
          );
          const publicOnly = publicCatalog.filter(
            (bookmark) => !ownedResourceIds.has(bookmark.resource_id),
          );
          topLevel = [...topLevelBookmarks, ...publicOnly].sort((left, right) => {
            if (this.#sortBy === "oldest") {
              return (
                new Date(left.created_at).getTime() -
                new Date(right.created_at).getTime()
              );
            }

            if (this.#sortBy === "alpha-asc") {
              return left.page_title.localeCompare(right.page_title);
            }

            if (this.#sortBy === "alpha-desc") {
              return right.page_title.localeCompare(left.page_title);
            }

            return (
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime()
            );
          });
        } else {
          topLevel = topLevelBookmarks;
        }
      }

      const filteredBookmarks = this.#filterBookmarks(topLevel);

      if (this.#isInitialLoad) {
        this.#isInitialLoad = false;
      }

      this.#updateSearchResultsInfo(filteredBookmarks.length, topLevel.length);

      if (!filteredBookmarks.length) {
        this.#showNoBookmarks(
          this.#scope === "public"
            ? "No public bookmarks have been approved yet."
            : "Why not add your first?",
        );
        return;
      }

      let bookmarksList = this.querySelector("#bookmarks-list");
      if (!bookmarksList) {
        bookmarksList = document.createElement("ul");
        bookmarksList.className = "reset-list bookmarks-list";
        bookmarksList.id = "bookmarks-list";
        bookmarksContainer.innerHTML = "";
        bookmarksContainer.append(bookmarksList);
      } else {
        bookmarksList.innerHTML = "";
      }

      bookmarksList.classList.toggle("multiple", filteredBookmarks.length > 1);

      for (const bookmark of filteredBookmarks) {
        const entry = await this.#renderEntry(
          entryTmpl,
          bookmark,
          children.get(bookmark.id) || [],
        );
        bookmarksList.append(entry);
      }
    } catch (error) {
      console.info("Error rendering bookmarks:", error);
      bookmarksContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load bookmarks. Please try refreshing the page.</p>
        </div>
      `;
    }
  }

  async refresh() {
    await this.#renderBookmarks();
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }
}

if (!customElements.get("linkstack-bookmarks")) {
  customElements.define("linkstack-bookmarks", LinkStackBookmarks);
}
