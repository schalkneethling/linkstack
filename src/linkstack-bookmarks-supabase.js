import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

/**
 * Bookmarks component that uses Supabase for data storage
 */
export class LinkStackBookmarks extends HTMLElement {
  static #selectors = {
    bookmarksContainer: "#bookmarks-container",
    bookmarksEntryTmpl: "#bookmarks-entry-tmpl",
    bookmarkChildTmpl: "#bookmark-child-tmpl",
    linkstackEditDialog: "linkstack-edit-dialog",
    noBookmarksTmpl: "#no-bookmarks-tmpl",
    skeletonLoaderTmpl: "#skeleton-loader-tmpl",
    searchInput: "#search-input",
    clearSearchButton: "#clear-search",
    searchResultsInfo: ".search-results-info",
    sortSelect: "#sort-select",
    filterButtons: ".filter-button",
  };

  #elements = {
    bookmarksContainer: null,
    linkstackEditDialog: null,
    searchInput: null,
    clearSearchButton: null,
    searchResultsInfo: null,
    sortSelect: null,
    filterButtons: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #renderPromise = null;
  #isInitialLoad = true;
  #searchQuery = "";
  #sortBy = "newest";
  #filterBy = "unread";
  #searchDebounceTimer = null;
  #boundHandlers = {
    onBookmarkCreated: null,
    onBookmarkUpdated: null,
  };

  constructor() {
    super();
  }

  connectedCallback() {
    this.#init();
  }

  disconnectedCallback() {
    // Clean up event listeners to prevent memory leaks
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
  }

  async #init() {
    this.#elements.bookmarksContainer = this.querySelector(
      LinkStackBookmarks.#selectors.bookmarksContainer,
    );
    this.#elements.linkstackEditDialog = document.querySelector(
      LinkStackBookmarks.#selectors.linkstackEditDialog,
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

    // Read search query from URL
    const params = new URLSearchParams(window.location.search);
    this.#searchQuery = params.get("search") || "";

    if (this.#searchQuery && this.#elements.searchInput) {
      this.#elements.searchInput.value = this.#searchQuery;
      this.#elements.clearSearchButton.hidden = false;
    }

    // Read sort preference: URL takes precedence, localStorage preserves user's own preference
    // localStorage is for direct navigation (bookmarks, typing URL), not for sharing state
    const urlSort = params.get("sort");
    const savedSort = localStorage.getItem("linkstack:sortBy");
    this.#sortBy = urlSort || savedSort || "newest";

    if (this.#elements.sortSelect) {
      this.#elements.sortSelect.value = this.#sortBy;
    }

    // Read filter preference: URL takes precedence, localStorage preserves user's own preference
    const urlFilter = params.get("filter");
    const savedFilter = localStorage.getItem("linkstack:filterBy");
    this.#filterBy = urlFilter || savedFilter || "unread";

    // Set active filter button
    this.#setActiveFilterButton(this.#filterBy);

    this.#addEventListeners();
    this.#setupSearch();
    this.#setupSort();
    this.#setupFilter();
    await this.#renderBookmarks();
  }

  #addEventListeners() {
    const { bookmarksContainer } = this.#elements;

    // Store bound handlers for cleanup
    this.#boundHandlers.onBookmarkCreated = async () => {
      await this.#renderBookmarks();
    };

    this.#boundHandlers.onBookmarkUpdated = async () => {
      await this.#renderBookmarks();
    };

    // Listen for bookmark-created custom event
    window.addEventListener(
      "bookmark-created",
      this.#boundHandlers.onBookmarkCreated,
    );

    // Listen for bookmark-updated custom event
    window.addEventListener(
      "bookmark-updated",
      this.#boundHandlers.onBookmarkUpdated,
    );

    bookmarksContainer.addEventListener("click", async (event) => {
      // Handle stack toggle clicks
      const stackToggle = event.target.closest(".stack-toggle");
      if (stackToggle) {
        this.#toggleStack(stackToggle);
        return;
      }

      // Handle read/unread toggle
      const readToggle = event.target.closest("#toggle-read-status");
      if (readToggle) {
        const { id } = readToggle.dataset;
        await this.#toggleReadStatus(id, readToggle);
        return;
      }

      // Handle context menu trigger click
      const contextMenuTrigger = event.target.closest(".context-menu-trigger");
      if (contextMenuTrigger) {
        const contextMenu = contextMenuTrigger.nextElementSibling;
        if (contextMenu && contextMenu.hasAttribute("popover")) {
          contextMenu.togglePopover();
        }
        return;
      }

      if (event.target.id === "delete-bookmark") {
        const { id } = event.target.dataset;
        // Close the context menu popover if open
        const contextMenu = event.target.closest(".context-menu");
        if (contextMenu) {
          contextMenu.hidePopover();
        }
        await this.#deleteBookmark(id);
      }

      if (event.target.id === "edit-bookmark") {
        const { id } = event.target.dataset;
        const { linkstackEditDialog } = this.#elements;

        // Close the context menu popover if open
        const contextMenu = event.target.closest(".context-menu");
        if (contextMenu) {
          contextMenu.hidePopover();
        }

        if (!linkstackEditDialog) {
          throw new Error("Linkstack edit dialog not found");
        }

        const editBookmarkEvent = new CustomEvent("edit-bookmark", {
          detail: { id },
        });

        linkstackEditDialog.dispatchEvent(editBookmarkEvent);
      }
    });
  }

  #toggleStack(toggleButton) {
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
    const stackChildren = toggleButton.nextElementSibling;
    const stackLabel = toggleButton.querySelector(".stack-label");

    if (isExpanded) {
      toggleButton.setAttribute("aria-expanded", "false");
      stackChildren.classList.add("hidden");
      stackLabel.textContent = "Show stack";
    } else {
      toggleButton.setAttribute("aria-expanded", "true");
      stackChildren.classList.remove("hidden");
      stackLabel.textContent = "Hide stack";
    }
  }

  /**
   * Set up search functionality
   * @private
   */
  #setupSearch() {
    const { searchInput, clearSearchButton } = this.#elements;

    if (!searchInput) {
      return;
    }

    // Search on input with debounce
    searchInput.addEventListener("input", (event) => {
      const query = event.target.value.trim();

      // Show/hide clear button
      if (clearSearchButton) {
        clearSearchButton.hidden = !query;
      }

      // Debounce search
      clearTimeout(this.#searchDebounceTimer);
      this.#searchDebounceTimer = setTimeout(() => {
        this.#handleSearch(query);
      }, 300);
    });

    // Clear search button
    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", () => {
        this.#clearSearch();
      });
    }

    // Listen for browser back/forward
    window.addEventListener("popstate", () => {
      const params = new URLSearchParams(window.location.search);
      const query = params.get("search") || "";
      const sort = params.get("sort") || this.#sortBy;
      const filter = params.get("filter") || "all";
      this.#applySearch(query);
      this.#applySort(sort);
      this.#applyFilter(filter);
    });
  }

  /**
   * Setup sort controls
   * @private
   */
  #setupSort() {
    const { sortSelect } = this.#elements;

    if (!sortSelect) {
      return;
    }

    // Sort on change
    sortSelect.addEventListener("change", (event) => {
      const sortBy = event.target.value;
      this.#handleSort(sortBy);
    });
  }

  /**
   * Setup filter controls
   * @private
   */
  #setupFilter() {
    const { filterButtons } = this.#elements;

    if (!filterButtons || filterButtons.length === 0) {
      return;
    }

    // Filter on click
    filterButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        const filterBy = event.target.dataset.filter;
        this.#handleFilter(filterBy);
      });
    });

    // Listen for browser back/forward to update filter state
    window.addEventListener("popstate", () => {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get("filter") || this.#filterBy;
      this.#applyFilter(filter);
    });
  }

  /**
   * Set the active filter button
   * @private
   */
  #setActiveFilterButton(filterBy) {
    const { filterButtons } = this.#elements;

    if (!filterButtons || filterButtons.length === 0) {
      return;
    }

    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === filterBy;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive);
    });
  }

  /**
   * Handle search query change
   * @private
   */
  async #handleSearch(query) {
    this.#searchQuery = query;
    this.#updateUrlWithSearch(query);
    await this.#renderBookmarks();
  }

  /**
   * Handle sort change from user interaction
   * Updates URL and persists preference to localStorage
   * @private
   */
  async #handleSort(sortBy) {
    this.#sortBy = sortBy;
    this.#updateUrlWithSort(sortBy);
    // Save to localStorage as fallback when URL has no sort parameter
    localStorage.setItem("linkstack:sortBy", sortBy);
    await this.#renderBookmarks();
  }

  /**
   * Handle filter change from user interaction
   * Updates URL and persists preference to localStorage
   * @private
   */
  async #handleFilter(filterBy) {
    this.#filterBy = filterBy;
    this.#setActiveFilterButton(filterBy);
    this.#updateUrlWithFilter(filterBy);
    // Save to localStorage as fallback when URL has no filter parameter
    localStorage.setItem("linkstack:filterBy", filterBy);
    await this.#renderBookmarks();
  }

  /**
   * Apply search from URL or history
   * @private
   */
  async #applySearch(query) {
    this.#searchQuery = query;
    const { searchInput, clearSearchButton } = this.#elements;

    if (searchInput) {
      searchInput.value = query;
    }

    if (clearSearchButton) {
      clearSearchButton.hidden = !query;
    }

    await this.#renderBookmarks();
  }

  /**
   * Clear search
   * @private
   */
  async #clearSearch() {
    this.#searchQuery = "";
    const { searchInput, clearSearchButton } = this.#elements;

    if (searchInput) {
      searchInput.value = "";
    }

    if (clearSearchButton) {
      clearSearchButton.hidden = true;
    }

    this.#updateUrlWithSearch("");
    await this.#renderBookmarks();
  }

  /**
   * Update URL with search query
   * @private
   */
  #updateUrlWithSearch(query) {
    const url = new URL(window.location);

    if (query) {
      url.searchParams.set("search", query);
    } else {
      url.searchParams.delete("search");
    }

    window.history.replaceState({}, "", url);
  }

  /**
   * Update URL with sort parameter
   * @private
   */
  #updateUrlWithSort(sortBy) {
    const url = new URL(window.location);

    if (sortBy && sortBy !== "newest") {
      url.searchParams.set("sort", sortBy);
    } else {
      url.searchParams.delete("sort");
    }

    window.history.replaceState({}, "", url);
  }

  /**
   * Update URL with filter parameter
   * @private
   */
  #updateUrlWithFilter(filterBy) {
    const url = new URL(window.location);

    if (filterBy && filterBy !== "all") {
      url.searchParams.set("filter", filterBy);
    } else {
      url.searchParams.delete("filter");
    }

    window.history.replaceState({}, "", url);
  }

  /**
   * Apply sort state (e.g., from browser navigation or initialization)
   * Updates UI dropdown and re-renders bookmarks
   * @private
   */
  async #applySort(sortBy) {
    this.#sortBy = sortBy;

    if (this.#elements.sortSelect) {
      this.#elements.sortSelect.value = sortBy;
    }

    await this.#renderBookmarks();
  }

  /**
   * Apply filter state (e.g., from browser navigation or initialization)
   * Updates UI buttons and re-renders bookmarks
   * @private
   */
  async #applyFilter(filterBy) {
    this.#filterBy = filterBy;
    this.#setActiveFilterButton(filterBy);
    await this.#renderBookmarks();
  }

  /**
   * Filter bookmarks by search query and read status
   * @private
   */
  #filterBookmarks(bookmarks, query) {
    let filtered = bookmarks;

    // Apply read status filter
    if (this.#filterBy === "read") {
      filtered = filtered.filter((bookmark) => bookmark.is_read === true);
    } else if (this.#filterBy === "unread") {
      filtered = filtered.filter((bookmark) => bookmark.is_read !== true);
    }

    // Apply search query filter
    if (!query.trim()) {
      return filtered;
    }

    const lowerQuery = query.toLowerCase();

    return filtered.filter((bookmark) => {
      const title = bookmark.page_title?.toLowerCase() || "";
      const description = bookmark.meta_description?.toLowerCase() || "";
      const url = bookmark.url?.toLowerCase() || "";
      const notes = bookmark.notes?.toLowerCase() || "";

      return (
        title.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        url.includes(lowerQuery) ||
        notes.includes(lowerQuery)
      );
    });
  }

  /**
   * Update search results info
   * @private
   */
  #updateSearchResultsInfo(filteredCount, totalCount) {
    const { searchResultsInfo } = this.#elements;

    if (!searchResultsInfo) {
      return;
    }

    if (this.#searchQuery && filteredCount !== totalCount) {
      searchResultsInfo.textContent = `Showing ${filteredCount} of ${totalCount} bookmarks`;
    } else {
      searchResultsInfo.textContent = "";
    }
  }

  async #toggleReadStatus(id, button) {
    const currentStatus = button.dataset.isRead === "true";
    const newStatus = !currentStatus;

    // Set loading state
    const originalText = button.querySelector(".read-text").textContent;
    button.disabled = true;
    button.querySelector(".read-text").textContent = "Updating...";

    try {
      await this.#bookmarksService.toggleReadStatus(id, newStatus);

      // Update button state
      button.dataset.isRead = newStatus;
      button.querySelector(".read-text").textContent = newStatus
        ? "Mark as Unread"
        : "Mark as Read";
      button.setAttribute(
        "aria-label",
        newStatus ? "Mark as unread" : "Mark as read",
      );

      // Add visual indicator
      const bookmarkEntry = this.querySelector(`#bookmark-entry-${id}`);
      if (bookmarkEntry) {
        if (newStatus) {
          bookmarkEntry.classList.add("read");
        } else {
          bookmarkEntry.classList.remove("read");
        }
      }

      // Show success toast
      const toast = document.querySelector("linkstack-toast");
      toast.show(`Marked as ${newStatus ? "read" : "unread"}`, "success");
    } catch (error) {
      console.error("Error toggling read status:", error);
      const toast = document.querySelector("linkstack-toast");
      toast.show("Failed to update read status. Please try again.", "error");

      // Reset button state on error
      button.querySelector(".read-text").textContent = originalText;
    } finally {
      button.disabled = false;
    }
  }

  async #deleteBookmark(id) {
    const deleteButton = this.querySelector(
      `#bookmark-entry-${id} #delete-bookmark`,
    );

    // Set loading state on button
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.setAttribute("aria-busy", "true");
      deleteButton.textContent = "Deleting...";
    }

    try {
      await this.#bookmarksService.delete(id);

      // Remove from DOM
      this.querySelector(`#bookmark-entry-${id}`)?.remove();

      // Show success toast
      const toast = document.querySelector("linkstack-toast");
      toast.show("Bookmark deleted successfully", "success");

      // Check if we need to show empty state
      const bookmarksList = this.querySelector("#bookmarks-list");
      if (!bookmarksList || bookmarksList.children.length === 0) {
        this.#showNoBookmarks();
      }
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      const toast = document.querySelector("linkstack-toast");
      toast.show("Failed to delete bookmark. Please try again.", "error");

      // Reset button state on error
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.removeAttribute("aria-busy");
        deleteButton.textContent = "Remove Bookmark";
      }
    }
  }

  #showNoBookmarks() {
    const { bookmarksContainer } = this.#elements;
    const noBookmarksTmpl = this.querySelector(
      LinkStackBookmarks.#selectors.noBookmarksTmpl,
    );
    const noBookmarks = noBookmarksTmpl.content.cloneNode(true);

    bookmarksContainer.innerHTML = "";
    bookmarksContainer.append(noBookmarks);
  }

  #showSkeletonLoader() {
    const { bookmarksContainer } = this.#elements;
    const skeletonTmpl = this.querySelector(
      LinkStackBookmarks.#selectors.skeletonLoaderTmpl,
    );

    if (!skeletonTmpl) {
      return;
    }

    const skeleton = skeletonTmpl.content.cloneNode(true);
    bookmarksContainer.innerHTML = "";
    bookmarksContainer.append(skeleton);
  }

  #hideSkeletonLoader() {
    const { bookmarksContainer } = this.#elements;
    const skeletonLoader = bookmarksContainer.querySelector(".skeleton-loader");

    if (skeletonLoader) {
      skeletonLoader.remove();
    }
  }

  async #renderBookmarks() {
    // Serialize render calls to prevent race conditions
    // If a render is in-flight, chain the next one after it completes
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
    const { bookmarksContainer } = this.#elements;
    const entryTmpl = this.querySelector(
      LinkStackBookmarks.#selectors.bookmarksEntryTmpl,
    );
    const childTmpl = this.querySelector(
      LinkStackBookmarks.#selectors.bookmarkChildTmpl,
    );

    if (!bookmarksContainer) {
      return;
    }

    // Show skeleton loader only on initial load
    if (this.#isInitialLoad) {
      this.#showSkeletonLoader();
    }

    try {
      // Get only top-level bookmarks with sorting
      const allBookmarks = await this.#bookmarksService.getTopLevel(
        this.#sortBy,
      );

      // Hide skeleton loader
      if (this.#isInitialLoad) {
        this.#hideSkeletonLoader();
        this.#isInitialLoad = false;
      }

      if (!allBookmarks || allBookmarks.length === 0) {
        this.#showNoBookmarks();
        this.#updateSearchResultsInfo(0, 0);
        return;
      }

      // Apply search filter
      const bookmarks = this.#filterBookmarks(allBookmarks, this.#searchQuery);

      // Update search results info
      this.#updateSearchResultsInfo(bookmarks.length, allBookmarks.length);

      // Handle empty search results
      if (bookmarks.length === 0 && this.#searchQuery) {
        // Create empty state DOM safely to prevent XSS
        const wrapper = document.createElement("div");
        wrapper.className = "no-bookmarks-wrapper";

        const container = document.createElement("div");
        container.className = "no-bookmarks";

        const heading = document.createElement("h2");
        heading.textContent = "No results found";

        const message = document.createElement("p");
        message.className = "text-medium";
        message.textContent = `No bookmarks match your search query "${this.#searchQuery}"`;

        container.appendChild(heading);
        container.appendChild(message);
        wrapper.appendChild(container);

        bookmarksContainer.innerHTML = "";
        bookmarksContainer.appendChild(wrapper);
        return;
      }

      if (bookmarks.length === 0) {
        this.#showNoBookmarks();
        return;
      }

      const bookmarkElements = await Promise.all(
        bookmarks.map(async (bookmark) => {
          const entry = entryTmpl.content.cloneNode(true);
          const bookmarkLink = entry.querySelector(".bookmark-link");
          const deleteBookmark = entry.querySelector("#delete-bookmark");
          const editBookmark = entry.querySelector("#edit-bookmark");
          const stackToggle = entry.querySelector(".stack-toggle");
          const stackChildren = entry.querySelector(".stack-children");

          entry.querySelector(".bookmark-img").src = bookmark.preview_img;

          bookmarkLink.href = bookmark.url;
          bookmarkLink.querySelector(".bookmark-title").textContent =
            bookmark.page_title;

          entry.querySelector(".bookmark-description").textContent =
            bookmark.meta_description;

          // Handle notes - only show if present
          const notesContainer = entry.querySelector(".bookmark-notes");
          const notesContent = entry.querySelector(".notes-content");
          if (bookmark.notes && bookmark.notes.trim()) {
            notesContent.textContent = bookmark.notes;
            notesContainer.classList.remove("hidden");
          }

          deleteBookmark.dataset.id = bookmark.id;
          editBookmark.dataset.id = bookmark.id;

          // Setup read/unread toggle
          const readToggle = entry.querySelector("#toggle-read-status");
          readToggle.dataset.id = bookmark.id;
          readToggle.dataset.isRead = bookmark.is_read || false;

          if (bookmark.is_read) {
            readToggle.querySelector(".read-text").textContent =
              "Mark as Unread";
            readToggle.setAttribute("aria-label", "Mark as unread");
          }

          const bookmarkEntry = entry.querySelector(".bookmark-entry");
          bookmarkEntry.id = `bookmark-entry-${bookmark.id}`;

          if (bookmark.is_read) {
            bookmarkEntry.classList.add("read");
          }

          // Load children for this bookmark with sorting
          const allChildren = await this.#bookmarksService.getChildren(
            bookmark.id,
            this.#sortBy,
          );

          // Apply search filter to children as well
          const children = this.#filterBookmarks(
            allChildren,
            this.#searchQuery,
          );

          if (children && children.length > 0) {
            // Show stack toggle
            stackToggle.classList.remove("hidden");
            stackToggle.dataset.id = bookmark.id;

            // Render children
            children.forEach((child) => {
              const childEntry = childTmpl.content.cloneNode(true);
              const childLink = childEntry.querySelector(".bookmark-link");
              const childDelete = childEntry.querySelector("#delete-bookmark");
              const childEdit = childEntry.querySelector("#edit-bookmark");

              childLink.href = child.url;
              childLink.querySelector(".bookmark-title").textContent =
                child.page_title;

              childEntry.querySelector(".bookmark-description").textContent =
                child.meta_description;

              // Handle notes - only show if present
              const childNotesContainer =
                childEntry.querySelector(".bookmark-notes");
              const childNotesContent =
                childEntry.querySelector(".notes-content");
              if (child.notes && child.notes.trim()) {
                childNotesContent.textContent = child.notes;
                childNotesContainer.classList.remove("hidden");
              }

              childDelete.dataset.id = child.id;
              childEdit.dataset.id = child.id;

              // Setup read/unread toggle for child
              const childReadToggle = childEntry.querySelector(
                "#toggle-read-status",
              );
              childReadToggle.dataset.id = child.id;
              childReadToggle.dataset.isRead = child.is_read || false;

              if (child.is_read) {
                childReadToggle.querySelector(".read-text").textContent =
                  "Mark as Unread";
                childReadToggle.setAttribute("aria-label", "Mark as unread");
              }

              const bookmarkChild = childEntry.querySelector(".bookmark-child");
              bookmarkChild.id = `bookmark-entry-${child.id}`;

              if (child.is_read) {
                bookmarkChild.classList.add("read");
              }

              stackChildren.appendChild(childEntry);
            });
          }

          return entry;
        }),
      );

      let bookmarksList = this.querySelector("#bookmarks-list");

      if (bookmarksList) {
        bookmarksList.classList.remove("multiple");
        bookmarksList.innerHTML = "";
      } else {
        bookmarksList = document.createElement("ul");
        bookmarksList.classList.add("reset-list", "bookmarks-list");
        bookmarksList.id = "bookmarks-list";

        bookmarksContainer.innerHTML = "";
        bookmarksContainer.append(bookmarksList);
      }

      if (bookmarks.length > 1) {
        bookmarksList.classList.add("multiple");
      }

      bookmarksList.append(...bookmarkElements);
    } catch (error) {
      console.error("Error rendering bookmarks:", error);

      // Hide skeleton loader on error
      if (this.#isInitialLoad) {
        this.#hideSkeletonLoader();
        this.#isInitialLoad = false;
      }

      bookmarksContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load bookmarks. Please try refreshing the page.</p>
        </div>
      `;
    }
  }

  /**
   * Public method to refresh bookmarks (called after updates)
   */
  async refresh() {
    await this.#renderBookmarks();
  }
}

customElements.define("linkstack-bookmarks", LinkStackBookmarks);
