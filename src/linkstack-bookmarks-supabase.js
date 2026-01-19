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
  };

  #elements = {
    bookmarksContainer: null,
    linkstackEditDialog: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #renderPromise = null;
  #isInitialLoad = true;
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

    this.#addEventListeners();
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
      // Handle thread toggle clicks
      const threadToggle = event.target.closest(".thread-toggle");
      if (threadToggle) {
        this.#toggleThread(threadToggle);
        return;
      }

      // Handle read/unread toggle
      const readToggle = event.target.closest("#toggle-read-status");
      if (readToggle) {
        const { id } = readToggle.dataset;
        await this.#toggleReadStatus(id, readToggle);
        return;
      }

      if (event.target.id === "delete-bookmark") {
        const { id } = event.target.dataset;
        await this.#deleteBookmark(id);
      }

      if (event.target.id === "edit-bookmark") {
        const { id } = event.target.dataset;
        const { linkstackEditDialog } = this.#elements;

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

  #toggleThread(toggleButton) {
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
    const threadChildren = toggleButton.nextElementSibling;
    const threadLabel = toggleButton.querySelector(".thread-label");

    if (isExpanded) {
      toggleButton.setAttribute("aria-expanded", "false");
      threadChildren.classList.add("hidden");
      threadLabel.textContent = "Show thread";
    } else {
      toggleButton.setAttribute("aria-expanded", "true");
      threadChildren.classList.remove("hidden");
      threadLabel.textContent = "Hide thread";
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
      toast.show(
        `Marked as ${newStatus ? "read" : "unread"}`,
        "success",
      );
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
      // Get only top-level bookmarks
      const bookmarks = await this.#bookmarksService.getTopLevel();

      // Hide skeleton loader
      if (this.#isInitialLoad) {
        this.#hideSkeletonLoader();
        this.#isInitialLoad = false;
      }

      if (!bookmarks || bookmarks.length === 0) {
        this.#showNoBookmarks();
        return;
      }

      const bookmarkElements = await Promise.all(
        bookmarks.map(async (bookmark) => {
          const entry = entryTmpl.content.cloneNode(true);
          const bookmarkLink = entry.querySelector(".bookmark-link");
          const deleteBookmark = entry.querySelector("#delete-bookmark");
          const editBookmark = entry.querySelector("#edit-bookmark");
          const threadToggle = entry.querySelector(".thread-toggle");
          const threadChildren = entry.querySelector(".thread-children");

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
            readToggle.querySelector(".read-text").textContent = "Mark as Unread";
            readToggle.setAttribute("aria-label", "Mark as unread");
          }

          const bookmarkEntry = entry.querySelector(".bookmark-entry");
          bookmarkEntry.id = `bookmark-entry-${bookmark.id}`;

          if (bookmark.is_read) {
            bookmarkEntry.classList.add("read");
          }

          // Load children for this bookmark
          const children = await this.#bookmarksService.getChildren(
            bookmark.id,
          );

          if (children && children.length > 0) {
            // Show thread toggle
            threadToggle.classList.remove("hidden");
            threadToggle.dataset.id = bookmark.id;

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
              const childReadToggle = childEntry.querySelector("#toggle-read-status");
              childReadToggle.dataset.id = child.id;
              childReadToggle.dataset.isRead = child.is_read || false;

              if (child.is_read) {
                childReadToggle.querySelector(".read-text").textContent = "Mark as Unread";
                childReadToggle.setAttribute("aria-label", "Mark as unread");
              }

              const bookmarkChild = childEntry.querySelector(".bookmark-child");
              bookmarkChild.id = `bookmark-entry-${child.id}`;

              if (child.is_read) {
                bookmarkChild.classList.add("read");
              }

              threadChildren.appendChild(childEntry);
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
