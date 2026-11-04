import { safeLocalStorage } from "./storage";
const key = "imsop:auth-change";
const sender = crypto.randomUUID();
export function publishAuthChange() {
  const message = { sender, id: crypto.randomUUID() };
  safeLocalStorage.setItem(key, JSON.stringify(message));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(key);
      channel.postMessage(message);
      channel.close();
    } catch {
      /* Storage events still cover browsers without channel support. */
    }
  }
}
export function subscribeAuthChanges(changed: () => void) {
  let last = "";
  const receive = (message: unknown) => {
    if (!message || typeof message !== "object") return;
    const value = message as { sender?: unknown; id?: unknown };
    if (
      value.sender === sender ||
      typeof value.id !== "string" ||
      value.id === last
    )
      return;
    last = value.id;
    changed();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === key && event.newValue) {
      try {
        receive(JSON.parse(event.newValue));
      } catch {
        /* Ignore malformed local state. */
      }
    }
  };
  window.addEventListener("storage", storage);
  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(key);
      channel.onmessage = event => receive(event.data);
    }
  } catch {
    /* Storage event fallback. */
  }
  return () => {
    window.removeEventListener("storage", storage);
    channel?.close();
  };
}
