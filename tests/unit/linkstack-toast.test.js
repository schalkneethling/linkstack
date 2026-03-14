// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("linkstack-toast", () => {
  beforeEach(async () => {
    document.body.innerHTML = "<linkstack-toast></linkstack-toast>";
    await import("../../src/components/linkstack-toast.js");
  });

  it("renders a toast with a dismiss button and icon", () => {
    const toast = /** @type {HTMLElement & {
     *   show: (message: string, type?: "success" | "error" | "warning" | "info", duration?: number) => void
     * }} */ (document.querySelector("linkstack-toast"));

    toast.show("Saved", "success", 0);

    const toastElement = document.querySelector(".toast");
    const icon = toastElement?.querySelector(".toast-icon svg");
    const closeButton = toastElement?.querySelector(".toast-close");

    expect(toastElement?.textContent).toContain("Saved");
    expect(icon).toBeTruthy();
    expect(closeButton).toBeTruthy();
  });

  it("dismisses a toast when the close button is clicked", () => {
    vi.useFakeTimers();

    const toast = /** @type {HTMLElement & {
     *   show: (message: string, type?: "success" | "error" | "warning" | "info", duration?: number) => void
     * }} */ (document.querySelector("linkstack-toast"));

    toast.show("Saved", "success", 0);

    const closeButton = /** @type {HTMLButtonElement} */ (
      document.querySelector(".toast-close")
    );
    closeButton.click();
    vi.advanceTimersByTime(300);

    expect(document.querySelector(".toast")).toBeNull();
    vi.useRealTimers();
  });
});
