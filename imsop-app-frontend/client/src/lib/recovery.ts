// A recovery credential lives only in this document's memory. Reload requires reopening the mail link.
let captured: string | null = null;
export function parseResetToken(href: string): string | null {
  try {
    const url = new URL(href),
      hashQuery = url.hash.split("?").slice(1).join("?");
    const tokens = [
      ...url.searchParams.getAll("token"),
      ...new URLSearchParams(hashQuery).getAll("token"),
    ];
    return tokens.length === 1 &&
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tokens[0]) &&
      tokens[0].length <= 4096
      ? tokens[0]
      : null;
  } catch {
    return null;
  }
}
export function captureResetToken() {
  const url = new URL(window.location.href);
  const [route, query = ""] = url.hash.slice(1).split("?");
  if (route !== "/reset-password") return captured;
  const params = new URLSearchParams(query);
  if (url.searchParams.has("token") || params.has("token")) {
    captured = parseResetToken(url.href);
    url.searchParams.delete("token");
    params.delete("token");
    url.hash = route + (params.size ? "?" + params : "");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event("imsop:recovery-link"));
  }
  return captured;
}
export function forgetResetToken() {
  captured = null;
}
export const PASSWORD_GUIDANCE = "Use 12–128 characters.";
