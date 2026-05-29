type Listener = () => void

const listeners = new Set<Listener>()

export function emitChatRefresh() {
  listeners.forEach((listener) => listener())
}

export function subscribeChatRefresh(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
