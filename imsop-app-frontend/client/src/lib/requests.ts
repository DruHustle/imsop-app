import { API_ORIGIN } from "./api-origin";
export async function requestJSON(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  signal?: AbortSignal
): Promise<any> {
  const controller = new AbortController(),
    cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 15000);
  try {
    const response = await fetch(API_ORIGIN + path, {
      method,
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401)
      window.dispatchEvent(new Event("imsop:session-expired"));
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : response.status === 403
            ? "Your account does not have access to this workspace capability."
            : "The request could not be completed. Check your entries and retry."
      );
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The request was cancelled or timed out. Retry when ready."
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
