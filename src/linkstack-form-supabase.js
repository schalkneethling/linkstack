import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

/**
 * Form component for adding bookmarks with Supabase storage
 */
export class LinkStackForm extends HTMLElement {
  static #selectors = {
    bookmarkForm: "#bookmark-form",
  };

  #bookmarksService = new BookmarksService(supabase);

  constructor() {
    super();
  }

  connectedCallback() {
    this.#addEventListeners();
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

    if (bookmarkForm) {
      bookmarkForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Use port 8888 for Netlify dev server in development
        const isDev = window.location.hostname === 'localhost';
        const baseUrl = isDev ? 'http://localhost:8888' : window.location.origin;
        const endpoint = `${baseUrl}/.netlify/functions/get-bookmark-data`;
        const formData = new FormData(bookmarkForm);
        const url = formData.get("url");

        try {
          const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);

          if (response.ok) {
            const metadata = await response.json();

            // Test if preview image loads
            const img = new Image();

            img.onload = async () => {
              try {
                await this.#addBookmark({
                  url,
                  page_title: metadata.pageTitle,
                  meta_description: metadata.metaDescription,
                  preview_img: metadata.previewImg,
                });
                bookmarkForm.reset();
              } catch (error) {
                console.error("Error adding bookmark:", error);
                alert(error.message || "Failed to add bookmark. Please try again.");
              }
            };

            img.onerror = async () => {
              try {
                await this.#addBookmark({
                  url,
                  page_title: metadata.pageTitle,
                  meta_description: metadata.metaDescription,
                  preview_img: previewFallback,
                });
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
