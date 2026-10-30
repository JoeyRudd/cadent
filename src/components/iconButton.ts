// A link row's focus ring, and with the hover tint for a row on a plain surface.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
export const ROW_LINK = `hover:bg-bg active:bg-bg ${FOCUS_RING}`;

// The round 44px icon button in page headers (Settings, Back, Sync), for a <Link> or a <button>.
export const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink active:bg-bg";

// The full-width accent button that finishes a card's form or leads to its next step.
export const PRIMARY_BUTTON =
  "h-12 rounded-button bg-accent text-base font-semibold text-on-accent active:opacity-80 disabled:opacity-50";

// The full-width outlined button for the quieter choice beside a primary one (Disconnect, Cancel).
export const SECONDARY_BUTTON =
  "flex h-12 items-center justify-center rounded-button border border-line text-base font-semibold text-ink active:opacity-70 disabled:opacity-50";
