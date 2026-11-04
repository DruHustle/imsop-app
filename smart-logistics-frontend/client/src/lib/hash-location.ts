import { useHashLocation } from "wouter/use-hash-location";
// Retain Wouter's hash router; keep list filters in the hash so links survive reload.
export function useWorkspaceLocation(): [
  string,
  (to: string, options?: { replace?: boolean; state?: unknown }) => void,
] {
  const [raw] = useHashLocation();
  const navigate = (
    to: string,
    options?: { replace?: boolean; state?: unknown }
  ) => {
    const target = window.location.pathname + window.location.search + "#" + to;
    window.history[options?.replace ? "replaceState" : "pushState"](
      options?.state ?? null,
      "",
      target
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return [raw.split("?")[0], navigate];
}
useWorkspaceLocation.hrefs = (href: string) => "#" + href;
export function useHashQuery() {
  const [raw] = useHashLocation();
  return new URLSearchParams(raw.split("?")[1] ?? "");
}
