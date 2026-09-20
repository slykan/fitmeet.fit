// Lets a focused "long list" screen (Hub, Meet's People/Events, Feed's
// Moments) claim the Android hardware back button for itself: if the list is
// scrolled down, the first back press scrolls it to the top instead of
// navigating away, and only a second press (now at the top, so this returns
// false) continues normal back navigation. Only one screen is ever focused
// at a time, so a single slot is enough -- no registry needed.
type BackScrollHandler = () => boolean

let handler: BackScrollHandler | null = null

export function setBackScrollHandler(fn: BackScrollHandler | null) {
  handler = fn
}

export function consumeBackScrollToTop(): boolean {
  return handler ? handler() : false
}

// Lets a screen that swaps its own content in place (e.g. Messages showing a
// conversation thread instead of the list, without changing route/pathname)
// fully claim the hardware back button so the tab-history logic in
// (tabs)/_layout.tsx never sees the press. Unlike the scroll handler above
// this always consumes the press -- there's no "already handled, fall
// through" case.
type BackOverrideHandler = () => void

let overrideHandler: BackOverrideHandler | null = null

export function setBackOverride(fn: BackOverrideHandler | null) {
  overrideHandler = fn
}

export function consumeBackOverride(): boolean {
  if (!overrideHandler) return false
  overrideHandler()
  return true
}
