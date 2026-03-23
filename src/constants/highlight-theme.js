// @ts-check

export const DEFAULT_HIGHLIGHT_COLOR = "default";

export const HIGHLIGHT_THEMES = Object.freeze({
  default: Object.freeze({
    label: "Default",
    accent: "#0d9488",
    accentHover: "#0f766e",
    accentSubtle: "#ccfbf1",
    accentMuted: "rgb(13 148 136 / 8%)",
    borderFocus: "#0d9488",
    swatch: "#0d9488",
  }),
  amber: Object.freeze({
    label: "Amber",
    accent: "#d97706",
    accentHover: "#b45309",
    accentSubtle: "#fef3c7",
    accentMuted: "rgb(217 119 6 / 10%)",
    borderFocus: "#d97706",
    swatch: "#d97706",
  }),
  cobalt: Object.freeze({
    label: "Cobalt",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    accentSubtle: "#dbeafe",
    accentMuted: "rgb(37 99 235 / 10%)",
    borderFocus: "#2563eb",
    swatch: "#2563eb",
  }),
  rose: Object.freeze({
    label: "Rose",
    accent: "#e11d48",
    accentHover: "#be123c",
    accentSubtle: "#ffe4e6",
    accentMuted: "rgb(225 29 72 / 10%)",
    borderFocus: "#e11d48",
    swatch: "#e11d48",
  }),
  plum: Object.freeze({
    label: "Plum",
    accent: "#7c3aed",
    accentHover: "#6d28d9",
    accentSubtle: "#ede9fe",
    accentMuted: "rgb(124 58 237 / 10%)",
    borderFocus: "#7c3aed",
    swatch: "#7c3aed",
  }),
  moss: Object.freeze({
    label: "Moss",
    accent: "#4d7c0f",
    accentHover: "#3f6212",
    accentSubtle: "#ecfccb",
    accentMuted: "rgb(77 124 15 / 10%)",
    borderFocus: "#4d7c0f",
    swatch: "#4d7c0f",
  }),
});

export const HIGHLIGHT_COLOR_OPTIONS = Object.freeze(
  Object.entries(HIGHLIGHT_THEMES).map(([value, theme]) =>
    Object.freeze({
      value,
      label: theme.label,
      swatch: theme.swatch,
    }),
  ),
);

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeHighlightColor(value) {
  return typeof value === "string" && value in HIGHLIGHT_THEMES
    ? value
    : DEFAULT_HIGHLIGHT_COLOR;
}

/**
 * @param {unknown} value
 */
export function getHighlightTheme(value) {
  return HIGHLIGHT_THEMES[normalizeHighlightColor(value)];
}
