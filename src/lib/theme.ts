// Light or dark: follow the device ("system"), or a choice saved in this browser from Settings.
// The choice lives on <html data-theme>, which globals.css turns into `color-scheme`.

export type Theme = "system" | "light" | "dark";

const KEY = "cadent.theme";

/** The browser bar colour: the `bg` token's light and dark values (globals.css). */
export const BAR_COLORS = { light: "#f4f5ef", dark: "#141a17" } as const;

// For System, layout.tsx's `viewport` gives one theme-color per scheme. A choice adds this one
// first in <head>, with no media query, so it wins. React doesn't render it, so hydration leaves it be.
const BAR_ID = "cadent-bar";

/** Runs in <head> before the first paint so a saved choice never flashes the other theme. */
export const APPLY_SAVED_THEME = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;var m=document.createElement("meta");m.name="theme-color";m.id="${BAR_ID}";m.content=${JSON.stringify(BAR_COLORS)}[t];document.head.prepend(m)}}catch(e){}`;

const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  // Another tab changed the choice: follow it here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    applyTheme(event.newValue === "light" || event.newValue === "dark" ? event.newValue : "system");
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function currentTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

/** Sets data-theme and the browser bar colour for `theme`, without saving it. */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  let bar = document.getElementById(BAR_ID) as HTMLMetaElement | null;
  if (theme === "system") {
    delete root.dataset.theme;
    bar?.remove();
  } else {
    root.dataset.theme = theme;
    if (!bar) {
      bar = Object.assign(document.createElement("meta"), { name: "theme-color", id: BAR_ID });
      document.head.prepend(bar);
    }
    bar.content = BAR_COLORS[theme];
  }
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked (private browsing): the choice still applies until the page reloads.
  }
  listeners.forEach((listener) => listener());
}
