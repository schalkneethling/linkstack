import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";
import { validateUrl } from "./utils/validation-schemas.js";

/**
 * Form component for adding bookmarks with Supabase storage
 */
export class LinkStackForm extends HTMLElement {
  static #selectors = {
    bookmarkForm: "#bookmark-form",
    parentSelect: "#parent-bookmark",
    urlInput: "#url",
    urlError: "#url-error",
    submitButton: "#submit-bookmark",
  };

  #bookmarksService = new BookmarksService(supabase);
  #boundHandlers = {
    onBookmarkCreated: null,
  };
  #isSubmitting = false;

  constructor() {
    super();
  }

  connectedCallback() {
    this.#addEventListeners();
    this.#populateParentSelect();
    this.#setupUrlValidation();
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

    // Show success toast
    const toast = document.querySelector("linkstack-toast");
    toast.show("Bookmark added successfully!", "success");

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent("bookmark-created"));
  }

  /**
   * Set up real-time URL validation
   * @private
   */
  #setupUrlValidation() {
    const urlInput = this.querySelector(LinkStackForm.#selectors.urlInput);

    if (!urlInput) {
      return;
    }

    // Validate on blur (when user leaves the field)
    urlInput.addEventListener("blur", () => {
      this.#validateUrlField();
    });

    // Clear error on input (as user types)
    urlInput.addEventListener("input", () => {
      this.#clearUrlError();
    });
  }

  /**
   * Validate URL field and show inline error if invalid
   * @private
   * @returns {boolean} - True if valid, false otherwise
   */
  #validateUrlField() {
    const urlInput = this.querySelector(LinkStackForm.#selectors.urlInput);
    const url = urlInput?.value.trim();

    if (!url) {
      return false;
    }

    const result = validateUrl(url);

    if (!result.success) {
      const errorMessage = result.error.errors[0]?.message || "Invalid URL";
      this.#showUrlError(errorMessage);
      return false;
    }

    this.#clearUrlError();
    return true;
  }

  /**
   * Show URL validation error
   * @private
   */
  #showUrlError(message) {
    const urlInput = this.querySelector(LinkStackForm.#selectors.urlInput);
    const errorEl = this.querySelector(LinkStackForm.#selectors.urlError);

    if (urlInput) {
      urlInput.setAttribute("aria-invalid", "true");
      urlInput.classList.add("error");
    }

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  /**
   * Clear URL validation error
   * @private
   */
  #clearUrlError() {
    const urlInput = this.querySelector(LinkStackForm.#selectors.urlInput);
    const errorEl = this.querySelector(LinkStackForm.#selectors.urlError);

    if (urlInput) {
      urlInput.removeAttribute("aria-invalid");
      urlInput.classList.remove("error");
    }

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  /**
   * Check if URL already exists in bookmarks
   * @private
   * @returns {Promise<boolean>} - True if duplicate exists
   */
  async #checkDuplicateUrl(url) {
    try {
      const bookmarks = await this.#bookmarksService.fetchAll();
      return bookmarks.some((bookmark) => bookmark.url === url);
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return false;
    }
  }

  /**
   * Set loading state on submit button
   * @private
   */
  #setSubmitButtonLoading(isLoading) {
    const submitButton = this.querySelector(
      LinkStackForm.#selectors.submitButton,
    );

    if (!submitButton) {
      return;
    }

    const buttonText = submitButton.querySelector(".button-text");
    const buttonLoading = submitButton.querySelector(".button-loading");

    if (isLoading) {
      this.#isSubmitting = true;
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");

      if (buttonText) {
        buttonText.hidden = true;
      }

      if (buttonLoading) {
        buttonLoading.hidden = false;
      }
    } else {
      this.#isSubmitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");

      if (buttonText) {
        buttonText.hidden = false;
      }

      if (buttonLoading) {
        buttonLoading.hidden = true;
      }
    }
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

        // Prevent double submission
        if (this.#isSubmitting) {
          return;
        }

        const formData = new FormData(bookmarkForm);
        const url = formData.get("url")?.trim();
        const parentId = formData.get("parent_id");
        const notes = formData.get("notes");

        // Validate URL before submission
        if (!this.#validateUrlField()) {
          return;
        }

        // Check for duplicate URL
        const isDuplicate = await this.#checkDuplicateUrl(url);

        if (isDuplicate) {
          this.#showUrlError(
            "This URL has already been bookmarked. Please enter a different URL.",
          );
          return;
        }

        // Set loading state
        this.#setSubmitButtonLoading(true);

        // Use port 8888 for Netlify dev server in development
        const isDev = window.location.hostname === "localhost";
        const baseUrl = isDev
          ? "http://localhost:8888"
          : window.location.origin;
        const endpoint = `${baseUrl}/.netlify/functions/get-bookmark-data`;

        try {
          const response = await fetch(
            `${endpoint}?url=${encodeURIComponent(url)}`,
          );

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
                this.#setSubmitButtonLoading(false);
              } catch (error) {
                console.error("Error adding bookmark:", error);
                const toast = document.querySelector("linkstack-toast");
                toast.show(
                  error.message || "Failed to add bookmark. Please try again.",
                  "error",
                );
                this.#setSubmitButtonLoading(false);
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
                this.#setSubmitButtonLoading(false);
              } catch (error) {
                console.error("Error adding bookmark:", error);
                const toast = document.querySelector("linkstack-toast");
                toast.show(
                  error.message || "Failed to add bookmark. Please try again.",
                  "error",
                );
                this.#setSubmitButtonLoading(false);
              }
            };

            img.src = metadata.previewImg;
          } else {
            throw new Error("Failed to fetch bookmark metadata");
          }
        } catch (error) {
          console.error("Error submitting bookmark:", error);
          const toast = document.querySelector("linkstack-toast");

          // Provide user-friendly error messages
          let errorMessage = "Failed to add bookmark. Please try again.";
          if (error.message === "Failed to fetch") {
            const isDev = window.location.hostname === "localhost";
            if (isDev) {
              errorMessage =
                "Cannot connect to the server. Make sure you're running 'netlify dev' instead of a regular HTTP server.";
            } else {
              errorMessage =
                "Network error. Please check your connection and try again.";
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          toast.show(errorMessage, "error");
          this.#setSubmitButtonLoading(false);
        }
      });
    }
  }
}

customElements.define("linkstack-form", LinkStackForm);
