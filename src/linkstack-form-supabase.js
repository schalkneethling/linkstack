import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

/**
 * Form component for adding bookmarks with Supabase storage
 */
export class LinkStackForm extends HTMLElement {
  static #selectors = {
    bookmarkForm: "#bookmark-form",
    parentSelect: "#parent-bookmark",
  };

  #bookmarksService = new BookmarksService(supabase);
  #boundHandlers = {
    onBookmarkCreated: null,
  };

  constructor() {
    super();
  }

  connectedCallback() {
    this.#addEventListeners();
    this.#populateParentSelect();
  }

  disconnectedCallback() {
    // Clean up event listeners
    if (this.#boundHandlers.onBookmarkCreated) {
      window.removeEventListener(
        "bookmark-created",
        this.#boundHandlers.onBookmarkCreated,
      );
    }
  }

  async #populateParentSelect() {
    const parentSelect = this.querySelector(
      LinkStackForm.#selectors.parentSelect,
    );

    if (!parentSelect) {
      return;
    }

    try {
      const bookmarks = await this.#bookmarksService.getTopLevel();

      // Clear existing options except the first one (default)
      while (parentSelect.options.length > 1) {
        parentSelect.remove(1);
      }

      // Add bookmarks as options
      bookmarks.forEach((bookmark) => {
        const option = document.createElement("option");
        option.value = bookmark.id;
        option.textContent = bookmark.page_title;
        parentSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading parent bookmarks:", error);
    }
  }

  async #addBookmark(bookmarkData) {
    await this.#bookmarksService.create(bookmarkData);

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent("bookmark-created"));
  }

  #addEventListeners() {
    const bookmarkForm = this.querySelector(
      LinkStackForm.#selectors.bookmarkForm,
    );
    const previewFallback = "../assets/linkstack-fallback.webp";

    // Listen for bookmark-created to refresh parent select
    this.#boundHandlers.onBookmarkCreated = async () => {
      await this.#populateParentSelect();
    };

    window.addEventListener(
      "bookmark-created",
      this.#boundHandlers.onBookmarkCreated,
    );

    if (bookmarkForm) {
      bookmarkForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Use port 8888 for Netlify dev server in development
        const isDev = window.location.hostname === 'localhost';
        const baseUrl = isDev ? 'http://localhost:8888' : window.location.origin;
        const endpoint = `${baseUrl}/.netlify/functions/get-bookmark-data`;
        const formData = new FormData(bookmarkForm);
        const url = formData.get("url");
        const parentId = formData.get("parent_id");
        const notes = formData.get("notes");

        try {
          const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);

          if (response.ok) {
            const metadata = await response.json();

            // Test if preview image loads
            const img = new Image();

            img.onload = async () => {
              try {
                const bookmarkData = {
                  url,
                  page_title: metadata.pageTitle,
                  meta_description: metadata.metaDescription,
                  preview_img: metadata.previewImg,
                };

                // Add parent_id if selected
                if (parentId) {
                  bookmarkData.parent_id = parentId;
                }

                // Add notes if provided
                if (notes && notes.trim()) {
                  bookmarkData.notes = notes.trim();
                }

                await this.#addBookmark(bookmarkData);
                bookmarkForm.reset();
              } catch (error) {
                console.error("Error adding bookmark:", error);
                alert(error.message || "Failed to add bookmark. Please try again.");
              }
            };

            img.onerror = async () => {
              try {
                const bookmarkData = {
                  url,
                  page_title: metadata.pageTitle,
                  meta_description: metadata.metaDescription,
                  preview_img: previewFallback,
                };

                // Add parent_id if selected
                if (parentId) {
                  bookmarkData.parent_id = parentId;
                }

                // Add notes if provided
                if (notes && notes.trim()) {
                  bookmarkData.notes = notes.trim();
                }

                await this.#addBookmark(bookmarkData);
                bookmarkForm.reset();
              } catch (error) {
                console.error("Error adding bookmark:", error);
                alert(error.message || "Failed to add bookmark. Please try again.");
              }
            };

            img.src = metadata.previewImg;
          } else {
            throw new Error("Failed to fetch bookmark metadata");
          }
        } catch (error) {
          console.error("Error submitting bookmark:", error);
          alert(error.message || "Failed to add bookmark. Please try again.");
        }
      });
    }
  }
}

customElements.define("linkstack-form", LinkStackForm);
