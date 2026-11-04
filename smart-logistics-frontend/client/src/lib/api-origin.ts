// All API clients share the same origin so authenticated requests stay first-party.
export function resolveApiOrigin(
  configured: string | undefined,
  production: boolean,
  basePath: string
): string {
  if (production && basePath === "/") return "";
  return (
    configured?.trim().replace(/\/+$/, "") ||
    (production
      ? "https://imsop-api.152-70-22-84.sslip.io"
      : "http://localhost:3001")
  );
}
export const API_ORIGIN = resolveApiOrigin(
  import.meta.env.VITE_API_URL,
  import.meta.env.PROD,
  import.meta.env.BASE_URL
);
