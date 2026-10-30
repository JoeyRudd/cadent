// The in-app page before the current one, so a Back button can step back through history (keeping
// scroll position) when that is where it leads. Written by RefreshOnReturn, read by BackLink.

let current: string | undefined;
let previous: string | undefined;

/** Records that the app is now showing `url` (path and query). */
export function visit(url: string): void {
  if (url === current) return;
  previous = current;
  current = url;
}

/** Whether the page before this one is `url`. */
export function cameFrom(url: string): boolean {
  return previous === url;
}
