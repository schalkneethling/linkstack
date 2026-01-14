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
    this.#addEventListeners();
  }

  async #addBookmark(bookmarkData) {
    try {
      await this.#bookmarksService.create(bookmarkData);

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("bookmark-created"));
    } catch (error) {
      console.error("Error adding bookmark:", error);
      throw new Error(`Error adding bookmark: ${error.message}`);
    }
  }

  #addEventListeners() {
    const bookmarkForm = this.querySelector(
      LinkStackForm.#selectors.bookmarkForm,
    );
    const previewFallback = "../assets/linkstack-fallback.webp";

    if (bookmarkForm) {
      bookmarkForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const endpoint = `${document.location.href}.netlify/functions/get-bookmark-data`;
        const formData = new FormData(bookmarkForm);
        const url = formData.get("url");

        try {
          const response = await fetch(`${endpoint}?url=${url}`);

          if (response.ok) {
            const metadata = await response.json();

            // Test if preview image loads
            const img = new Image();
            img.src = metadata.previewImg;

            img.onload = async () => {
              await this.#addBookmark({
                url,
                page_title: metadata.pageTitle,
                meta_description: metadata.metaDescription,
                preview_img: metadata.previewImg,
              });
              bookmarkForm.reset();
            };

            img.onerror = async () => {
              await this.#addBookmark({
                url,
                page_title: metadata.pageTitle,
                meta_description: metadata.metaDescription,
                preview_img: previewFallback,
              });
              bookmarkForm.reset();
            };
          } else {
            throw new Error("Failed to fetch bookmark metadata");
          }
        } catch (error) {
          console.error("Error submitting bookmark:", error);
          alert("Failed to add bookmark. Please try again.");
        }
      });
    }
  }
}

customElements.define("linkstack-form", LinkStackForm);
