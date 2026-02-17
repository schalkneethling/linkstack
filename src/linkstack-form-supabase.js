import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";
import { SettingsService } from "./services/settings.service.js";
import { getRandomEncouragementMessage } from "./utils/encouragement-messages.js";
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
  #settingsService = new SettingsService();
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
   * Check if adding a bookmark would exceed the unread limit
   * @private
   * @returns {Promise<boolean>} - True if limit would be exceeded
   */
  async #wouldExceedUnreadLimit() {
    const isEnabled = this.#settingsService.isLimitEnabled();
    console.log("[Limit Check] Feature enabled:", isEnabled);

    if (!isEnabled) {
      return false;
    }

    try {
      const allBookmarks = await this.#bookmarksService.fetchAll();
      const unreadCount = allBookmarks.filter((b) => !b.is_read).length;
      const limit = this.#settingsService.getUnreadLimit();

      console.log("[Limit Check] Unread count:", unreadCount, "Limit:", limit, "Would exceed:", unreadCount >= limit);

      return unreadCount >= limit;
    } catch (error) {
      console.error("Error checking unread limit:", error);
      return false;
    }
  }

  /**
   * Highlight a random unread bookmark to encourage reading
   * @private
   */
  async #highlightRandomUnreadBookmark() {
    try {
      const allBookmarks = await this.#bookmarksService.fetchAll();
      const unreadBookmarks = allBookmarks.filter((b) => !b.is_read);

      if (unreadBookmarks.length === 0) {
        return;
      }

      // Pick a random unread bookmark
      const randomIndex = Math.floor(Math.random() * unreadBookmarks.length);
      const randomBookmark = unreadBookmarks[randomIndex];

      // Find the DOM element for this bookmark
      const bookmarkElement = document.getElementById(
        `bookmark-entry-${randomBookmark.id}`,
      );

      if (bookmarkElement) {
        // Add highlight class
        bookmarkElement.classList.add("bookmark-highlight");

        // Scroll into view
        bookmarkElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Remove highlight after 5 seconds
        setTimeout(() => {
          bookmarkElement.classList.remove("bookmark-highlight");
        }, 5000);
      }
    } catch (error) {
      console.error("Error highlighting bookmark:", error);
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

        // Check if adding would exceed unread limit
        const wouldExceedLimit = await this.#wouldExceedUnreadLimit();

        if (wouldExceedLimit) {
          // Close the form drawer first
          const formDrawer = document.getElementById("form-drawer");
          formDrawer?.hidePopover();

          // Show toast after a brief delay to ensure drawer is closed
          setTimeout(() => {
            const toast = document.querySelector("linkstack-toast");
            const message = getRandomEncouragementMessage();
            toast?.show(message, "warning");

            // Highlight a random unread bookmark
            this.#highlightRandomUnreadBookmark();
          }, 150);

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
            // Metadata extraction failed - save with fallback data
            console.warn(
              "Metadata extraction failed, saving with fallback data",
            );
            const urlObj = new URL(url);
            const fallbackTitle = urlObj.hostname.replace("www.", "");

            const bookmarkData = {
              url,
              page_title: fallbackTitle,
              meta_description: "",
              preview_img: "",
            };

            if (parentId) {
              bookmarkData.parent_id = parentId;
            }

            if (notes && notes.trim()) {
              bookmarkData.notes = notes.trim();
            }

            try {
              await this.#addBookmark(bookmarkData);
              bookmarkForm.reset();
              const toast = document.querySelector("linkstack-toast");
              toast.show(
                "Bookmark saved (metadata unavailable for this site)",
                "warning",
              );
            } catch (addError) {
              console.error("Error adding bookmark:", addError);
              const toast = document.querySelector("linkstack-toast");
              toast.show(
                addError.message || "Failed to add bookmark. Please try again.",
                "error",
              );
            }
            this.#setSubmitButtonLoading(false);
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
