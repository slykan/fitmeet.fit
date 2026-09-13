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
