// @ts-check
import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

/**
 * Edit dialog component for updating bookmarks with Supabase storage
 */
export class LinkStackEditDialog extends HTMLElement {
  static #selectors = {
    buttonCloseDialog: "#dialog-close",
    editBookmarkForm: "#edit-bookmark-form",
    editId: "#edit-id",
    editTitleInput: "#edit-title",
    editDescriptionInput: "#edit-description",
    editNotesInput: "#edit-notes",
    editTagsInput: "#edit-tags",
    editDialog: "dialog",
    linkstackBookmarks: "linkstack-bookmarks",
    saveButton: "#save-changes-button",
  };

  #elements = {
    /** @type {HTMLButtonElement | null} */
    buttonCloseDialog: null,
    /** @type {HTMLFormElement | null} */
    editBookmarkForm: null,
    /** @type {HTMLInputElement | null} */
    editId: null,
    /** @type {HTMLInputElement | null} */
    editTitleInput: null,
    /** @type {HTMLTextAreaElement | null} */
    editDescriptionInput: null,
    /** @type {HTMLTextAreaElement | null} */
    editNotesInput: null,
    /** @type {HTMLInputElement | null} */
    editTagsInput: null,
    /** @type {HTMLDialogElement | null} */
    editDialog: null,
    linkstackBookmarks: null,
    /** @type {HTMLButtonElement | null} */
    saveButton: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #isSaving = false;
  #lastFocusedElement = null;

  connectedCallback() {
    this.#initElements();
    this.#addEventListeners();
  }

  #initElements() {
    this.#elements.buttonCloseDialog = this.querySelector(
      LinkStackEditDialog.#selectors.buttonCloseDialog,
    );
    this.#elements.editBookmarkForm = this.querySelector(
      LinkStackEditDialog.#selectors.editBookmarkForm,
    );
    this.#elements.editId = this.querySelector(
      LinkStackEditDialog.#selectors.editId,
    );
    this.#elements.editTitleInput = this.querySelector(
      LinkStackEditDialog.#selectors.editTitleInput,
    );
    this.#elements.editDescriptionInput = this.querySelector(
      LinkStackEditDialog.#selectors.editDescriptionInput,
    );
    this.#elements.editNotesInput = this.querySelector(
      LinkStackEditDialog.#selectors.editNotesInput,
    );
    this.#elements.editTagsInput = this.querySelector(
      LinkStackEditDialog.#selectors.editTagsInput,
    );
    this.#elements.editDialog = this.querySelector(
      LinkStackEditDialog.#selectors.editDialog,
    );
    this.#elements.linkstackBookmarks = document.querySelector(
      LinkStackEditDialog.#selectors.linkstackBookmarks,
    );
    this.#elements.saveButton = this.querySelector(
      LinkStackEditDialog.#selectors.saveButton,
    );
  }

  #addEventListeners() {
    const { buttonCloseDialog, editBookmarkForm, editDialog } = this.#elements;

    if (!buttonCloseDialog || !editBookmarkForm || !editDialog) {
      return;
    }

    this.addEventListener("edit-bookmark", async (event) => {
      const editEvent = /** @type {CustomEvent<{ id: string }>} */ (event);
      this.#lastFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await this.#editBookmark(editEvent.detail.id);
    });

    buttonCloseDialog.addEventListener("click", () => {
      editDialog.close();
    });

    editBookmarkForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Prevent double submission
      if (this.#isSaving) {
        return;
      }

      const formData = new FormData(editBookmarkForm);
      await this.#saveBookmarkChanges(formData);
    });

    editDialog.addEventListener("close", () => {
      if (this.#lastFocusedElement instanceof HTMLElement) {
        this.#lastFocusedElement.focus();
        this.#lastFocusedElement = null;
      }
    });
  }

  /**
   * Set loading state on save button
   */
  #setSaveButtonLoading(isLoading) {
    const { saveButton } = this.#elements;

    if (!saveButton) {
      return;
    }

    const buttonText = /** @type {HTMLElement | null} */ (
      saveButton.querySelector(".button-text")
    );
    const buttonLoading = /** @type {HTMLElement | null} */ (
      saveButton.querySelector(".button-loading")
    );

    if (isLoading) {
      this.#isSaving = true;
      saveButton.disabled = true;
      saveButton.setAttribute("aria-busy", "true");

      if (buttonText) {
        buttonText.hidden = true;
      }

      if (buttonLoading) {
        buttonLoading.hidden = false;
      }
    } else {
      this.#isSaving = false;
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");

      if (buttonText) {
        buttonText.hidden = false;
      }

      if (buttonLoading) {
        buttonLoading.hidden = true;
      }
    }
  }

  async #getBookmarkData(id) {
    try {
      return await this.#bookmarksService.getById(id);
    } catch (error) {
      throw new Error(this.#getErrorMessage(error, "Failed to load bookmark."), {
        cause: error,
      });
    }
  }

  async #saveBookmarkChanges(formData) {
    const { editDialog } = this.#elements;

    const id = formData.get("id");
    const page_title = formData.get("title");
    const meta_description = formData.get("description");
    const notes = formData.get("notes");
    const tagsRaw = formData.get("tags") || "";
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Set loading state
    this.#setSaveButtonLoading(true);

    try {
      await this.#bookmarksService.update(id, {
        page_title,
        meta_description,
        notes,
        tags,
      });

      // Show success toast
      const toast =
        /** @type {{ show: (message: string, type: string) => void } | null} */ (
          /** @type {unknown} */ (document.querySelector("linkstack-toast"))
        );
      toast?.show("Bookmark updated successfully!", "success");

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("bookmark-updated"));

      this.#setSaveButtonLoading(false);
      editDialog.close();
    } catch (error) {
      this.#showToast(
        this.#getErrorMessage(error, "Failed to save changes. Please try again."),
        "error",
      );
      this.#setSaveButtonLoading(false);
    }
  }

  async #editBookmark(id) {
    const {
      editDialog,
      editId,
      editTitleInput,
      editDescriptionInput,
      editNotesInput,
      editTagsInput,
    } = this.#elements;

    if (
      !editDialog ||
      !editId ||
      !editTitleInput ||
      !editDescriptionInput ||
      !editNotesInput ||
      !editTagsInput
    ) {
      return;
    }

    try {
      const bookmarkData = await this.#getBookmarkData(id);

      editId.value = id;
      editTitleInput.value = bookmarkData.page_title || "";
      editDescriptionInput.value = bookmarkData.meta_description || "";
      editNotesInput.value = bookmarkData.notes || "";
      editTagsInput.value = Array.isArray(bookmarkData.tags)
        ? bookmarkData.tags.join(", ")
        : "";

      editDialog.showModal();
      editTitleInput.focus();
    } catch (error) {
      this.#showToast(
        this.#getErrorMessage(error, "Failed to load bookmark. Please try again."),
        "error",
      );
    }
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }

  #getErrorMessage(error, fallbackMessage) {
    return error instanceof Error && error.message
      ? error.message
      : fallbackMessage;
  }
}

if (!customElements.get("linkstack-edit-dialog")) {
  customElements.define("linkstack-edit-dialog", LinkStackEditDialog);
}
