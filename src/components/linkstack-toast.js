// @ts-check

const SVG_NS = "http://www.w3.org/2000/svg";

function createLine(x1, y1, x2, y2) {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  return line;
}

function createPath(d) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  return path;
}

function createPolyline(points) {
  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("points", points);
  return polyline;
}

function createCircle(cx, cy, r) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", cx);
  circle.setAttribute("cy", cy);
  circle.setAttribute("r", r);
  return circle;
}

function createToastSvg() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  return svg;
}

function createCloseIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");
  svg.append(createLine("18", "6", "6", "18"), createLine("6", "6", "18", "18"));
  return svg;
}

function createIcon(type) {
  const svg = createToastSvg();

  switch (type) {
    case "success":
      svg.append(
        createPath("M22 11.08V12a10 10 0 1 1-5.93-9.14"),
        createPolyline("22 4 12 14.01 9 11.01"),
      );
      break;
    case "error":
      svg.append(
        createCircle("12", "12", "10"),
        createLine("15", "9", "9", "15"),
        createLine("9", "9", "15", "15"),
      );
      break;
    case "warning":
      svg.append(
        createPath("M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"),
        createLine("12", "9", "12", "13"),
        createLine("12", "17", "12.01", "17"),
      );
      break;
    case "info":
    default:
      svg.append(
        createCircle("12", "12", "10"),
        createLine("12", "16", "12", "12"),
        createLine("12", "8", "12.01", "8"),
      );
      break;
  }

  return svg;
}

function createToastHostTemplate() {
  const template = document.createElement("template");
  const container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("role", "region");
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "false");

  const toastTemplate = document.createElement("template");
  toastTemplate.id = "toast-template";

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");

  const icon = document.createElement("div");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");

  const message = document.createElement("div");
  message.className = "toast-message";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.append(createCloseIcon());

  toast.append(icon, message, closeButton);
  toastTemplate.content.append(toast);
  template.content.append(container, toastTemplate);

  return template;
}

const toastHostTemplate = createToastHostTemplate();

/**
 * LinkStack Toast Notification Component
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
    if (!this.querySelector(LinkStackToast.#selectors.container)) {
      this.appendChild(toastHostTemplate.content.cloneNode(true));
    }

    this.#container = this.querySelector(LinkStackToast.#selectors.container);
  }

  /**
   * @param {string} message
   * @param {"success" | "error" | "warning" | "info"} [type]
   * @param {number} [duration]
   */
  show(message, type = "info", duration = 5000) {
    if (this.#toasts.length >= this.#maxToasts) {
      this.#dismissOldest();
    }

    const toast = this.#createToast(message, type);
    this.#toasts.push(toast);
    this.#container?.appendChild(toast.element);

    requestAnimationFrame(() => {
      toast.element.classList.add("show");
    });

    if (duration > 0) {
      toast.timeoutId = setTimeout(() => {
        this.dismiss(toast.id);
      }, duration);
    }
  }

  #createToast(message, type) {
    const id = crypto.randomUUID();
    const template = /** @type {HTMLTemplateElement | null} */ (
      this.querySelector(LinkStackToast.#selectors.toastTemplate)
    );

    if (!template) {
      throw new Error("Toast template not found");
    }

    const fragment = /** @type {DocumentFragment} */ (
      template.content.cloneNode(true)
    );
    const element = /** @type {HTMLElement | null} */ (
      fragment.querySelector(".toast")
    );

    if (!element) {
      throw new Error("Toast element not found");
    }

    element.className = `toast toast-${type}`;
    element.id = id;
    element.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

    const icon = element.querySelector(".toast-icon");
    if (icon instanceof HTMLElement) {
      icon.replaceChildren(createIcon(type));
    }

    const messageEl = element.querySelector(".toast-message");
    if (messageEl instanceof HTMLElement) {
      messageEl.textContent = message;
    }

    const closeButton = element.querySelector(".toast-close");
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener("click", () => {
        this.dismiss(id);
      });
    }

    return {
      id,
      element,
      type,
      message,
      timeoutId: null,
    };
  }

  dismiss(toastId) {
    const toastIndex = this.#toasts.findIndex((toast) => toast.id === toastId);
    if (toastIndex === -1) {
      return;
    }

    const toast = this.#toasts[toastIndex];
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    toast.element.classList.remove("show");
    toast.element.classList.add("hide");

    setTimeout(() => {
      toast.element.remove();
      this.#toasts.splice(toastIndex, 1);
    }, 300);
  }

  #dismissOldest() {
    if (this.#toasts.length > 0) {
      this.dismiss(this.#toasts[0].id);
    }
  }

  dismissAll() {
    [...this.#toasts].forEach((toast) => {
      this.dismiss(toast.id);
    });
  }
}

if (!customElements.get("linkstack-toast")) {
  customElements.define("linkstack-toast", LinkStackToast);
}
