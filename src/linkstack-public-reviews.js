// @ts-check
import { supabase } from "./lib/supabase.js";
import { BookmarksService } from "./services/bookmarks.service.js";

const REJECTION_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "broken_link", label: "Broken link" },
  { value: "duplicate_public_entry", label: "Duplicate public entry" },
  { value: "insufficient_context", label: "Insufficient context" },
  { value: "unsafe_or_inappropriate", label: "Unsafe or inappropriate" },
  { value: "out_of_scope", label: "Out of scope" },
  { value: "other", label: "Other" },
];

export class LinkStackPublicReviews extends HTMLElement {
  #bookmarksService = new BookmarksService(supabase);
  #container = null;
  #summary = null;
  #isAdmin = false;

  connectedCallback() {
    this.#container = this.querySelector("#public-review-container");
    this.#summary = this.querySelector("#public-review-summary");

    window.addEventListener("auth-state-changed", async (event) => {
      const authEvent = /** @type {CustomEvent<{ isAdmin?: boolean }>} */ (event);
      this.#isAdmin = Boolean(authEvent.detail?.isAdmin);
      if (this.#isAdmin && !this.closest("#admin-panel")?.classList.contains("hidden")) {
        await this.render();
      }
    });

    window.addEventListener("public-review-panel-opened", async () => {
      if (this.#isAdmin) {
        await this.render();
      }
    });

    this.#container?.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-review-action]");
      if (!actionButton) {
        return;
      }

      const card = actionButton.closest(".review-card");
      const reasonSelect = card?.querySelector(".review-reason");
      const noteInput = card?.querySelector(".review-note");
      const action = actionButton.dataset.reviewAction;

        if (action === "reject" && !reasonSelect?.value) {
        const toast =
          /** @type {{ show: (message: string, type: string) => void } | null} */ (
            /** @type {unknown} */ (document.querySelector("linkstack-toast"))
          );
        toast?.show(
          "Choose a rejection reason before rejecting this bookmark.",
          "warning",
        );
        return;
      }

      try {
        await this.#bookmarksService.reviewPublicShare(actionButton.dataset.id, {
          decision: action,
          rejectionCode: action === "reject" ? reasonSelect.value : null,
          rejectionReason: action === "reject" ? noteInput?.value?.trim() || "" : "",
        });

        const toast =
          /** @type {{ show: (message: string, type: string) => void } | null} */ (
            /** @type {unknown} */ (document.querySelector("linkstack-toast"))
          );
        toast?.show(
          action === "approve"
            ? "Bookmark approved for the public catalog."
            : "Public listing rejected.",
          "success",
        );

        window.dispatchEvent(new CustomEvent("bookmark-updated"));
        await this.render();
      } catch (error) {
        console.info("Error reviewing public share:", error);
        const toast =
          /** @type {{ show: (message: string, type: string) => void } | null} */ (
            /** @type {unknown} */ (document.querySelector("linkstack-toast"))
          );
        toast?.show(
          error.message || "Failed to review bookmark.",
          "error",
        );
      }
    });
  }

  async render() {
    if (!this.#container) {
      return;
    }

    try {
      const reviews = await this.#bookmarksService.getPendingPublicListings();
      this.#container.innerHTML = "";

      if (!reviews.length) {
        this.#summary.textContent = "No bookmarks are waiting for review.";
        return;
      }

      this.#summary.textContent = `${reviews.length} bookmark${reviews.length === 1 ? "" : "s"} waiting for review.`;

      const list = document.createElement("ul");
      list.className = "reset-list bookmarks-list multiple";

      reviews.forEach((review) => {
        const item = document.createElement("li");
        item.className = "bookmark-entry review-card";
        item.innerHTML = `
          <div class="bookmark-info">
            <a class="bookmark-link" href="${review.url}" target="_blank" rel="noopener noreferrer">
              <h3 class="bookmark-title">${review.page_title}</h3>
            </a>
            <p class="bookmark-description">${review.meta_description || ""}</p>
            <div class="bookmark-tags"></div>
            <div class="form-field">
              <label for="review-reason-${review.public_listing_id}">Rejection reason</label>
              <select class="review-reason" id="review-reason-${review.public_listing_id}">
                ${REJECTION_OPTIONS.map(
                  (option) =>
                    `<option value="${option.value}">${option.label}</option>`,
                ).join("")}
              </select>
            </div>
            <div class="form-field">
              <label for="review-note-${review.public_listing_id}">Reviewer note (optional)</label>
              <input
                type="text"
                class="review-note"
                id="review-note-${review.public_listing_id}"
                placeholder="Add context for the submitter"
              />
            </div>
            <div class="bookmark-actions">
              <button
                type="button"
                class="button solid"
                data-review-action="approve"
                data-id="${review.public_listing_id}"
              >
                Approve
              </button>
              <button
                type="button"
                class="button solid critical"
                data-review-action="reject"
                data-id="${review.public_listing_id}"
              >
                Reject
              </button>
            </div>
          </div>
        `;

        const tagsContainer = item.querySelector(".bookmark-tags");
        (review.tags || []).forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "tag";
          chip.textContent = tag;
          tagsContainer.appendChild(chip);
        });

        list.appendChild(item);
      });

      this.#container.appendChild(list);
    } catch (error) {
      console.info("Error rendering moderation queue:", error);
      this.#summary.textContent = "Failed to load moderation queue.";
    }
  }
}

if (!customElements.get("linkstack-public-reviews")) {
  customElements.define("linkstack-public-reviews", LinkStackPublicReviews);
}
