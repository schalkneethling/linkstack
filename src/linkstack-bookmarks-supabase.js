import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

/**
 * Bookmarks component that uses Supabase for data storage
 */
export class LinkStackBookmarks extends HTMLElement {
  static #selectors = {
    bookmarksContainer: "#bookmarks-container",
    bookmarksEntryTmpl: "#bookmarks-entry-tmpl",
    linkstackEditDialog: "linkstack-edit-dialog",
    noBookmarksTmpl: "#no-bookmarks-tmpl",
  };

  #elements = {
    bookmarksContainer: null,
    linkstackEditDialog: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #renderPromise = null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.#init();
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

    // Listen for bookmark-created custom event
    window.addEventListener("bookmark-created", async () => {
      await this.#renderBookmarks();
    });

    // Listen for bookmark-updated custom event
    window.addEventListener("bookmark-updated", async () => {
      await this.#renderBookmarks();
    });

    bookmarksContainer.addEventListener("click", async (event) => {
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

  async #deleteBookmark(id) {
    try {
      await this.#bookmarksService.delete(id);

      // Remove from DOM
      this.querySelector(`#bookmark-entry-${id}`)?.remove();

      // Check if we need to show empty state
      const bookmarksList = this.querySelector("#bookmarks-list");
      if (!bookmarksList || bookmarksList.children.length === 0) {
        this.#showNoBookmarks();
      }
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      alert("Failed to delete bookmark. Please try again.");
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

    if (!bookmarksContainer) {
      return;
    }

    try {
      const bookmarks = await this.#bookmarksService.getAll();

      if (!bookmarks || bookmarks.length === 0) {
        this.#showNoBookmarks();
        return;
      }

      const bookmarkElements = bookmarks.map((bookmark) => {
        const entry = entryTmpl.content.cloneNode(true);
        const bookmarkLink = entry.querySelector(".bookmark-link");
        const deleteBookmark = entry.querySelector("#delete-bookmark");
        const editBookmark = entry.querySelector("#edit-bookmark");

        entry.querySelector(".bookmark-img").src = bookmark.preview_img;

        bookmarkLink.href = bookmark.url;
        bookmarkLink.querySelector(".bookmark-title").textContent =
          bookmark.page_title;

        entry.querySelector(".bookmark-description").textContent =
          bookmark.meta_description;

        deleteBookmark.dataset.id = bookmark.id;
        editBookmark.dataset.id = bookmark.id;

        entry.querySelector(".bookmark-entry").id =
          `bookmark-entry-${bookmark.id}`;

        return entry;
      });

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
