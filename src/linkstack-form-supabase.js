// @ts-check
import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";
import { SettingsService } from "./services/settings.service.js";
import { APP_EVENTS } from "./constants/app-events.js";
import { getRandomEncouragementMessage } from "./utils/encouragement-messages.js";
import { FORM_UI_MESSAGES } from "./constants/ui-strings.js";
import {
  validateBookmarkMetadata,
  getValidationMessage,
  validateUrl,
} from "./utils/validation-schemas.js";

export class LinkStackForm extends HTMLElement {
  static #selectors = {
    bookmarkForm: "#bookmark-form",
    parentSelect: "#parent-bookmark",
    requestPublic: "#request-public",
    requestPublicHelp: "#request-public-help",
    confirmDialog: "linkstack-confirm-dialog",
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

  connectedCallback() {
    this.#addEventListeners();
    this.#populateParentSelect();
    this.#setupUrlValidation();
    this.#setupPublicToggle();
  }

  disconnectedCallback() {
    if (this.#boundHandlers.onBookmarkCreated) {
      window.removeEventListener(
        APP_EVENTS.bookmarkCreated,
        this.#boundHandlers.onBookmarkCreated,
      );
    }
  }

  async #populateParentSelect() {
    const parentSelect = /** @type {HTMLSelectElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.parentSelect)
    );

    if (!parentSelect) {
      return;
    }

    try {
      const bookmarks = await this.#bookmarksService.getTopLevel();
      while (parentSelect.options.length > 1) {
        parentSelect.remove(1);
      }

      bookmarks.forEach((bookmark) => {
        const option = document.createElement("option");
        option.value = bookmark.id;
        option.textContent = bookmark.page_title;
        parentSelect.appendChild(option);
      });
    } catch {
      this.#showToast(FORM_UI_MESSAGES.loadStackOptionsFailed, "error");
    }
  }

  #setupUrlValidation() {
    const urlInput = /** @type {HTMLInputElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlInput)
    );

    if (!urlInput) {
      return;
    }

    urlInput.addEventListener("blur", () => {
      this.#validateUrlField();
    });

    urlInput.addEventListener("input", () => {
      this.#clearUrlError();
    });
  }

  #setupPublicToggle() {
    const parentSelect = /** @type {HTMLSelectElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.parentSelect)
    );
    const requestPublic = /** @type {HTMLInputElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.requestPublic)
    );
    const helpText = this.querySelector(LinkStackForm.#selectors.requestPublicHelp);

    if (!parentSelect || !requestPublic || !helpText) {
      return;
    }

    const syncState = () => {
      const hasParent = Boolean(parentSelect.value);
      requestPublic.disabled = hasParent;

      if (hasParent) {
        requestPublic.checked = false;
        helpText.textContent =
          FORM_UI_MESSAGES.publicTopLevelOnly;
      } else {
        helpText.textContent =
          FORM_UI_MESSAGES.publicRequiresApproval;
      }
    };

    if (!parentSelect.dataset.publicToggleBound) {
      parentSelect.addEventListener("change", syncState);
      parentSelect.dataset.publicToggleBound = "true";
    }

    syncState();
  }

  #validateUrlField() {
    const urlInput = /** @type {HTMLInputElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlInput)
    );
    const url = urlInput?.value.trim();

    if (!url) {
      return false;
    }

    const result = validateUrl(url);

    if (!result.success) {
      const errorMessage = getValidationMessage(result, "Invalid URL");
      this.#showUrlError(errorMessage);
      return false;
    }

    this.#clearUrlError();
    return true;
  }

  #showUrlError(message) {
    const urlInput = /** @type {HTMLInputElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlInput)
    );
    const errorEl = /** @type {HTMLElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlError)
    );

    if (urlInput) {
      urlInput.setAttribute("aria-invalid", "true");
      urlInput.classList.add("error");
    }

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  #clearUrlError() {
    const urlInput = /** @type {HTMLInputElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlInput)
    );
    const errorEl = /** @type {HTMLElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.urlError)
    );

    if (urlInput) {
      urlInput.removeAttribute("aria-invalid");
      urlInput.classList.remove("error");
    }

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  async #wouldExceedUnreadLimit() {
    if (!this.#settingsService.isLimitEnabled()) {
      return false;
    }

    try {
      const allBookmarks = await this.#bookmarksService.fetchAll();
      const unreadCount = allBookmarks.filter((bookmark) => !bookmark.is_read).length;
      return unreadCount >= this.#settingsService.getUnreadLimit();
    } catch {
      return false;
    }
  }

  async #highlightRandomUnreadBookmark() {
    try {
      const allBookmarks = await this.#bookmarksService.fetchAll();
      const unreadBookmarks = allBookmarks.filter((bookmark) => !bookmark.is_read);

      if (!unreadBookmarks.length) {
        return;
      }

      const randomBookmark =
        unreadBookmarks[Math.floor(Math.random() * unreadBookmarks.length)];
      const bookmarkElement = document.getElementById(
        `bookmark-entry-${randomBookmark.id}`,
      );

      if (!bookmarkElement) {
        return;
      }

      bookmarkElement.classList.add("bookmark-highlight");
      bookmarkElement.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        bookmarkElement.classList.remove("bookmark-highlight");
      }, 5000);
    } catch {
      // If the highlight fails, the encouragement message is still enough feedback.
    }
  }

  #setSubmitButtonLoading(isLoading) {
    const submitButton = /** @type {HTMLButtonElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.submitButton)
    );

    if (!submitButton) {
      return;
    }

    const buttonText = /** @type {HTMLElement | null} */ (
      submitButton.querySelector(".button-text")
    );
    const buttonLoading = /** @type {HTMLElement | null} */ (
      submitButton.querySelector(".button-loading")
    );

    this.#isSubmitting = isLoading;
    submitButton.disabled = isLoading;
    submitButton.toggleAttribute("aria-busy", isLoading);

    if (buttonText) {
      buttonText.hidden = isLoading;
    }

    if (buttonLoading) {
      buttonLoading.hidden = !isLoading;
    }
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }

  #dispatchCreated() {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.bookmarkCreated));
  }

  async #createWithMetadata({ url, notes, parentId, requestPublic, metadata }) {
    return this.#bookmarksService.create({
      url,
      page_title: metadata.pageTitle,
      meta_description: metadata.metaDescription,
      preview_img: metadata.previewImg,
      notes,
      parent_id: parentId || null,
      request_public: requestPublic,
    });
  }

  #getFallbackMetadata(url) {
    const urlObj = new URL(url);
    return {
      pageTitle: urlObj.hostname.replace("www.", ""),
      metaDescription: "",
      previewImg: "",
    };
  }

  #parseMetadataResponse(input, url) {
    const validationResult = validateBookmarkMetadata(input);
    if (validationResult.success) {
      return validationResult.output;
    }

    return this.#getFallbackMetadata(url);
  }

  async #handlePublicDuplicate({
    inspection,
    notes,
    parentId,
    requestPublic,
  }) {
    const confirmDialog =
      /** @type {{ confirm: (options: {
       *   title: string,
       *   message: string,
       *   confirmLabel?: string,
       *   cancelLabel?: string,
       * }) => Promise<boolean> } | null} */ (
        /** @type {unknown} */ (
          document.querySelector(LinkStackForm.#selectors.confirmDialog)
        )
      );

    const confirmed = await confirmDialog?.confirm({
      title: FORM_UI_MESSAGES.duplicatePublicTitle,
      message: FORM_UI_MESSAGES.duplicatePublicPrompt,
      confirmLabel: FORM_UI_MESSAGES.duplicatePublicConfirmAction,
      cancelLabel: FORM_UI_MESSAGES.duplicatePublicCancelAction,
    }) ?? false;

    if (!confirmed) {
      return null;
    }

    const bookmark = await this.#bookmarksService.addExistingPublicToLibrary({
      resourceId: inspection.resource.id,
      publicListingId: inspection.public_duplicate.id,
      notes,
      parentId,
    });

    this.#showToast(
      requestPublic
        ? FORM_UI_MESSAGES.addedPrivateInstead
        : FORM_UI_MESSAGES.addedPrivateBookmark,
      "success",
    );

    return bookmark;
  }

  #addEventListeners() {
    const bookmarkForm = /** @type {HTMLFormElement | null} */ (
      this.querySelector(LinkStackForm.#selectors.bookmarkForm)
    );

    this.#boundHandlers.onBookmarkCreated = async () => {
      await this.#populateParentSelect();
    };

    window.addEventListener(
      APP_EVENTS.bookmarkCreated,
      this.#boundHandlers.onBookmarkCreated,
    );

    if (!bookmarkForm) {
      return;
    }

    bookmarkForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (this.#isSubmitting) {
        return;
      }

      const formData = new FormData(bookmarkForm);
      const urlValue = formData.get("url");
      const url = typeof urlValue === "string" ? urlValue.trim() : "";
      const parentId = formData.get("parent_id") || null;
      const notesValue = formData.get("notes");
      const notes = typeof notesValue === "string" ? notesValue.trim() : "";
      const requestPublic = formData.get("request_public") === "on";

      if (!this.#validateUrlField()) {
        return;
      }

      const wouldExceedLimit = await this.#wouldExceedUnreadLimit();
      if (wouldExceedLimit) {
        document.getElementById("form-drawer")?.hidePopover();
        setTimeout(() => {
          this.#showToast(getRandomEncouragementMessage(), "warning");
          this.#highlightRandomUnreadBookmark();
        }, 150);
        return;
      }

      this.#setSubmitButtonLoading(true);

      try {
        const inspection = await this.#bookmarksService.inspectUrl(url);

        if (inspection.personal_duplicate) {
          this.#showUrlError(
            FORM_UI_MESSAGES.duplicateUrl,
          );
          this.#setSubmitButtonLoading(false);
          return;
        }

        if (inspection.public_duplicate) {
          const addedBookmark = await this.#handlePublicDuplicate({
            inspection,
            notes,
            parentId,
            requestPublic,
          });

          if (addedBookmark) {
            bookmarkForm.reset();
            this.#setupPublicToggle();
            this.#dispatchCreated();
          }

          this.#setSubmitButtonLoading(false);
          return;
        }

        const isDev = window.location.hostname === "localhost";
        const baseUrl = isDev ? "http://localhost:8888" : window.location.origin;
        const endpoint = `${baseUrl}/.netlify/functions/get-bookmark-data`;
        const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
          await this.#createWithMetadata({
            url,
            notes,
            parentId,
            requestPublic,
            metadata: this.#getFallbackMetadata(url),
          });

          bookmarkForm.reset();
          this.#setupPublicToggle();
          this.#showToast(
            FORM_UI_MESSAGES.metadataUnavailable,
            "warning",
          );
          this.#dispatchCreated();
          this.#setSubmitButtonLoading(false);
          return;
        }

        const metadata = this.#parseMetadataResponse(await response.json(), url);
        await this.#createWithMetadata({
          url,
          notes,
          parentId,
          requestPublic,
          metadata,
        });

        bookmarkForm.reset();
        this.#setupPublicToggle();
        this.#showToast(
          requestPublic
            ? FORM_UI_MESSAGES.bookmarkAddedWithReview
            : FORM_UI_MESSAGES.bookmarkAdded,
          "success",
        );
        this.#dispatchCreated();
      } catch (error) {
        this.#showToast(
          this.#getErrorMessage(error, FORM_UI_MESSAGES.addBookmarkFailed),
          "error",
        );
      } finally {
        this.#setSubmitButtonLoading(false);
      }
    });
  }

  #getErrorMessage(error, fallbackMessage) {
    return error instanceof Error && error.message
      ? error.message
      : fallbackMessage;
  }
}

if (!customElements.get("linkstack-form")) {
  customElements.define("linkstack-form", LinkStackForm);
}
