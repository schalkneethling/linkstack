// @ts-check
import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

const REVIEW_DECISIONS = Object.freeze({
  approve: "approve",
  reject: "reject",
});

const REJECTION_OPTIONS = Object.freeze([
  { value: "", label: "Select a reason" },
  { value: "broken_link", label: "Broken link" },
  { value: "duplicate_public_entry", label: "Duplicate public entry" },
  { value: "insufficient_context", label: "Insufficient context" },
  { value: "unsafe_or_inappropriate", label: "Unsafe or inappropriate" },
  { value: "out_of_scope", label: "Out of scope" },
  { value: "other", label: "Other" },
]);

const reviewCardTemplate = document.createElement("template");
reviewCardTemplate.innerHTML = `
  <li class="bookmark-entry review-card">
    <div class="bookmark-info">
      <a class="bookmark-link" target="_blank" rel="noopener noreferrer">
        <h3 class="bookmark-title"></h3>
      </a>
      <p class="bookmark-description"></p>
      <div class="bookmark-tags"></div>
      <div class="form-field">
        <label class="review-reason-label">Rejection reason</label>
        <select class="review-reason"></select>
      </div>
      <div class="form-field">
        <label class="review-note-label">Reviewer note (optional)</label>
        <input
          type="text"
          class="review-note"
          placeholder="Add context for the submitter"
        />
      </div>
      <div class="bookmark-actions">
        <button
          type="button"
          class="button solid"
          data-review-action="approve"
        >
          Approve
        </button>
        <button
          type="button"
          class="button solid critical"
          data-review-action="reject"
        >
          Reject
        </button>
      </div>
    </div>
  </li>
`;

/**
 * @typedef {{
 *   public_listing_id: string;
 *   url: string;
 *   page_title: string;
 *   meta_description?: string | null;
 *   tags?: string[] | null;
 * }} PendingReview
 */

export class LinkStackPublicReviews extends HTMLElement {
  #bookmarksService = new BookmarksService(supabase);
  #container = null;
  #summary = null;
  #isAdmin = false;
  #authStateChangedHandler = null;
  #panelOpenedHandler = null;
  #reviewClickHandler = null;

  connectedCallback() {
    this.#container = this.querySelector("#public-review-container");
    this.#summary = this.querySelector("#public-review-summary");

    if (!this.#authStateChangedHandler) {
      this.#authStateChangedHandler = async (event) => {
        const authEvent = /** @type {CustomEvent<{ isAdmin?: boolean }>} */ (event);
        this.#isAdmin = Boolean(authEvent.detail?.isAdmin);
        const adminPanel = this.closest("#admin-panel");
        if (this.#isAdmin && adminPanel instanceof HTMLElement && !adminPanel.hidden) {
          await this.render();
        }
      };
      window.addEventListener("auth-state-changed", this.#authStateChangedHandler);
    }

    if (!this.#panelOpenedHandler) {
      this.#panelOpenedHandler = async () => {
        if (this.#isAdmin) {
          await this.render();
          this.#focusSummary();
        }
      };
      window.addEventListener("public-review-panel-opened", this.#panelOpenedHandler);
    }

    if (this.#container && !this.#reviewClickHandler) {
      this.#reviewClickHandler = async (event) => {
        await this.#handleReviewClick(event);
      };
      this.#container.addEventListener("click", this.#reviewClickHandler);
    }
  }

  #focusSummary() {
    if (!(this.#summary instanceof HTMLElement)) {
      return;
    }

    this.#summary.tabIndex = -1;
    this.#summary.focus();
  }

  disconnectedCallback() {
    if (this.#authStateChangedHandler) {
      window.removeEventListener("auth-state-changed", this.#authStateChangedHandler);
      this.#authStateChangedHandler = null;
    }

    if (this.#panelOpenedHandler) {
      window.removeEventListener("public-review-panel-opened", this.#panelOpenedHandler);
      this.#panelOpenedHandler = null;
    }

    if (this.#container && this.#reviewClickHandler) {
      this.#container.removeEventListener("click", this.#reviewClickHandler);
      this.#reviewClickHandler = null;
    }
  }

  async #handleReviewClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const actionButton = target?.closest("[data-review-action]");
    if (!(actionButton instanceof HTMLButtonElement)) {
      return;
    }

    const card = actionButton.closest(".review-card");
    if (!card) {
      return;
    }

    const reasonSelect = card.querySelector(".review-reason");
    const noteInput = card.querySelector(".review-note");
    const action = actionButton.dataset.reviewAction;

    if (
      action === REVIEW_DECISIONS.reject &&
      !(reasonSelect instanceof HTMLSelectElement && reasonSelect.value)
    ) {
      this.#showToast(
        "Choose a rejection reason before rejecting this bookmark.",
        "warning",
      );
      return;
    }

    try {
      await this.#bookmarksService.reviewPublicShare(actionButton.dataset.id, {
        decision: action,
        rejectionCode:
          action === REVIEW_DECISIONS.reject && reasonSelect instanceof HTMLSelectElement
            ? reasonSelect.value
            : null,
        rejectionReason:
          action === REVIEW_DECISIONS.reject && noteInput instanceof HTMLInputElement
            ? noteInput.value.trim()
            : "",
      });

      this.#showToast(
        action === REVIEW_DECISIONS.approve
          ? "Bookmark approved for the public catalog."
          : "Public listing rejected.",
        "success",
      );

      window.dispatchEvent(new CustomEvent("bookmark-updated"));
      await this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to review bookmark.";
      this.#showToast(message, "error");
    }
  }

  async render() {
    if (!this.#container || !this.#summary) {
      return;
    }

    try {
      const reviews = await this.#bookmarksService.getPendingPublicListings();
      this.#container.replaceChildren();

      if (!reviews.length) {
        this.#summary.textContent = "No bookmarks are waiting for review.";
        return;
      }

      this.#summary.textContent = `${reviews.length} bookmark${reviews.length === 1 ? "" : "s"} waiting for review.`;

      const list = document.createElement("ul");
      list.className = "reset-list bookmarks-list multiple";

      reviews.forEach((review) => {
        list.append(this.#createReviewCard(review));
      });

      this.#container.append(list);
    } catch {
      this.#summary.textContent = "Failed to load moderation queue.";
    }
  }

  /**
   * @param {PendingReview} review
   */
  #createReviewCard(review) {
    const fragment =
      /** @type {DocumentFragment} */ (reviewCardTemplate.content.cloneNode(true));
    const item = fragment.firstElementChild;
    const link = fragment.querySelector(".bookmark-link");
    const title = fragment.querySelector(".bookmark-title");
    const description = fragment.querySelector(".bookmark-description");
    const tagsContainer = fragment.querySelector(".bookmark-tags");
    const reasonLabel = fragment.querySelector(".review-reason-label");
    const reasonSelect = fragment.querySelector(".review-reason");
    const noteLabel = fragment.querySelector(".review-note-label");
    const noteInput = fragment.querySelector(".review-note");
    const approveButton = fragment.querySelector('[data-review-action="approve"]');
    const rejectButton = fragment.querySelector('[data-review-action="reject"]');

    if (
      !(item instanceof HTMLLIElement) ||
      !(link instanceof HTMLAnchorElement) ||
      !(title instanceof HTMLElement) ||
      !(description instanceof HTMLElement) ||
      !(tagsContainer instanceof HTMLElement) ||
      !(reasonLabel instanceof HTMLLabelElement) ||
      !(reasonSelect instanceof HTMLSelectElement) ||
      !(noteLabel instanceof HTMLLabelElement) ||
      !(noteInput instanceof HTMLInputElement) ||
      !(approveButton instanceof HTMLButtonElement) ||
      !(rejectButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Public review template is missing required elements.");
    }

    const listingId = review.public_listing_id;
    const reasonSelectId = `review-reason-${listingId}`;
    const noteInputId = `review-note-${listingId}`;

    link.href = review.url;
    title.textContent = review.page_title;
    description.textContent = review.meta_description || "";
    reasonLabel.htmlFor = reasonSelectId;
    reasonSelect.id = reasonSelectId;
    noteLabel.htmlFor = noteInputId;
    noteInput.id = noteInputId;
    approveButton.dataset.id = listingId;
    rejectButton.dataset.id = listingId;

    REJECTION_OPTIONS.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      reasonSelect.append(optionElement);
    });

    (review.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      tagsContainer.append(chip);
    });

    return item;
  }

  #showToast(message, type) {
    const toast =
      /** @type {{ show: (message: string, type: string) => void } | null} */ (
        /** @type {unknown} */ (document.querySelector("linkstack-toast"))
      );
    toast?.show(message, type);
  }
}

if (!customElements.get("linkstack-public-reviews")) {
  customElements.define("linkstack-public-reviews", LinkStackPublicReviews);
}
