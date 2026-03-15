// @ts-check
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("form-drawer", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await import("../../src/form-drawer.js");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("moves focus into the drawer when opened and restores it when closed", async () => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "New";

    const drawer = /** @type {HTMLElement & { open: () => void; showPopover: () => void; hidePopover: () => void }} */ (
      document.createElement("form-drawer")
    );
    const urlInput = document.createElement("input");
    urlInput.id = "url";

    drawer.append(urlInput);
    document.body.append(trigger, drawer);

    drawer.showPopover = vi.fn();
    drawer.hidePopover = vi.fn();

    trigger.focus();
    drawer.open();

    const openEvent = new Event("toggle");
    Object.defineProperty(openEvent, "newState", {
      configurable: true,
      value: "open",
    });
    drawer.dispatchEvent(openEvent);

    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(urlInput);

    const closedEvent = new Event("toggle");
    Object.defineProperty(closedEvent, "newState", {
      configurable: true,
      value: "closed",
    });
    drawer.dispatchEvent(closedEvent);

    expect(document.activeElement).toBe(trigger);
  });
});
