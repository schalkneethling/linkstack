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
    editDialog: "dialog",
    linkstackBookmarks: "linkstack-bookmarks",
    saveButton: "#save-changes-button",
  };

  #elements = {
    buttonCloseDialog: null,
    editBookmarkForm: null,
    editId: null,
    editTitleInput: null,
    editDescriptionInput: null,
    editNotesInput: null,
    editDialog: null,
    linkstackBookmarks: null,
    saveButton: null,
  };

  #bookmarksService = new BookmarksService(supabase);
  #isSaving = false;

  constructor() {
    super();
  }

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

    this.addEventListener("edit-bookmark", async (event) => {
      await this.#editBookmark(event.detail.id);
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
  }

  /**
   * Set loading state on save button
   * @private
   */
  #setSaveButtonLoading(isLoading) {
    const { saveButton } = this.#elements;

    if (!saveButton) {
      return;
    }

    const buttonText = saveButton.querySelector(".button-text");
    const buttonLoading = saveButton.querySelector(".button-loading");

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
      console.error("Error getting bookmark data:", error);
      throw new Error(`Error getting bookmark data: ${error.message}`);
    }
  }

  async #saveBookmarkChanges(formData) {
    const { editDialog } = this.#elements;

    const id = formData.get("id");
    const page_title = formData.get("title");
    const meta_description = formData.get("description");
    const notes = formData.get("notes");

    // Set loading state
    this.#setSaveButtonLoading(true);

    try {
      await this.#bookmarksService.update(id, {
        page_title,
        meta_description,
        notes,
      });

      // Show success toast
      const toast = document.querySelector("linkstack-toast");
      toast.show("Bookmark updated successfully!", "success");

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("bookmark-updated"));

      this.#setSaveButtonLoading(false);
      editDialog.close();
    } catch (error) {
      console.error("Error saving bookmark changes:", error);
      const toast = document.querySelector("linkstack-toast");
      toast.show("Failed to save changes. Please try again.", "error");
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
    } = this.#elements;

    try {
      const bookmarkData = await this.#getBookmarkData(id);

      editId.value = id;
      editTitleInput.value = bookmarkData.page_title || "";
      editDescriptionInput.value = bookmarkData.meta_description || "";
      editNotesInput.value = bookmarkData.notes || "";

      editDialog.showModal();
    } catch (error) {
      console.error("Error loading bookmark for edit:", error);
      const toast = document.querySelector("linkstack-toast");
      toast.show("Failed to load bookmark. Please try again.", "error");
    }
  }
}

customElements.define("linkstack-edit-dialog", LinkStackEditDialog);
