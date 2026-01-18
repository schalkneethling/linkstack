/**
 * LinkStack Toast Notification Component
 *
 * Displays toast notifications for user feedback (success, error, warning, info).
 * Replaces browser alert() dialogs with accessible, non-blocking notifications.
 *
 * Features:
 * - Queue system for multiple simultaneous toasts
 * - Auto-dismiss with configurable timeout
 * - Manual dismiss via click
 * - ARIA live region for screen readers
 * - Keyboard accessible
 *
 * Usage:
 *   const toast = document.querySelector('linkstack-toast');
 *   toast.show('Bookmark saved!', 'success');
 *   toast.show('Failed to save bookmark', 'error');
 */

class LinkStackToast extends HTMLElement {
  #toasts = [];
  #maxToasts = 3;
  #container = null;

  static #selectors = {
    container: ".toast-container",
    toastTemplate: "#toast-template",
  };

  connectedCallback() {
    this.render();
    this.#container = this.querySelector(LinkStackToast.#selectors.container);
  }

  render() {
    const template = document.createElement("template");
    template.innerHTML = `
      <div class="toast-container" role="region" aria-live="polite" aria-atomic="false"></div>

      <template id="toast-template">
        <div class="toast" role="status">
          <div class="toast-icon" aria-hidden="true"></div>
          <div class="toast-message"></div>
          <button type="button" class="toast-close" aria-label="Dismiss notification">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </template>
    `;

    this.appendChild(template.content.cloneNode(true));
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   */
  show(message, type = "info", duration = 5000) {
    // Limit number of toasts
    if (this.#toasts.length >= this.#maxToasts) {
      this.#dismissOldest();
    }

    const toast = this.#createToast(message, type);
    this.#toasts.push(toast);
    this.#container.appendChild(toast.element);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.element.classList.add("show");
    });

    // Auto-dismiss
    if (duration > 0) {
      toast.timeoutId = setTimeout(() => {
        this.dismiss(toast.id);
      }, duration);
    }
  }

  /**
   * Create a toast element
   * @private
   */
  #createToast(message, type) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Clone template
    const template = this.querySelector(
      LinkStackToast.#selectors.toastTemplate,
    );
    const element = template.content.cloneNode(true).querySelector(".toast");

    // Set attributes
    element.className = `toast toast-${type}`;
    element.id = id;
    element.setAttribute(
      "aria-live",
      type === "error" ? "assertive" : "polite",
    );

    // Populate content
    const icon = element.querySelector(".toast-icon");
    icon.innerHTML = this.#getIcon(type);

    const messageEl = element.querySelector(".toast-message");
    messageEl.textContent = message;

    // Close button handler
    const closeButton = element.querySelector(".toast-close");
    closeButton.addEventListener("click", () => {
      this.dismiss(id);
    });

    return {
      id,
      element,
      type,
      message,
      timeoutId: null,
    };
  }

  /**
   * Dismiss a specific toast by ID
   */
  dismiss(toastId) {
    const toastIndex = this.#toasts.findIndex((t) => t.id === toastId);
    if (toastIndex === -1) return;

    const toast = this.#toasts[toastIndex];

    // Clear timeout if exists
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    // Animate out
    toast.element.classList.remove("show");
    toast.element.classList.add("hide");

    // Remove from DOM after animation
    setTimeout(() => {
      toast.element.remove();
      this.#toasts.splice(toastIndex, 1);
    }, 300);
  }

  /**
   * Dismiss the oldest toast (FIFO)
   * @private
   */
  #dismissOldest() {
    if (this.#toasts.length > 0) {
      this.dismiss(this.#toasts[0].id);
    }
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    [...this.#toasts].forEach((toast) => {
      this.dismiss(toast.id);
    });
  }

  /**
   * Get icon SVG for toast type
   * @private
   */
  #getIcon(type) {
    const icons = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`,
    };

    return icons[type] || icons.info;
  }
}

customElements.define("linkstack-toast", LinkStackToast);
