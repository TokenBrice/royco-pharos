// Small fetch helpers for the sync path: every upstream call is time-bounded and abort-aware so a
// hung Royco/Pharos endpoint can never hang a sync — it aborts and the caller falls back to
// last-known-good. This runs only in the Node sync/cron context, never in a request handler.

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request to ${url} timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) into a bounded millisecond
 * wait. Returns null if the header is absent/unparseable. Capped by maxMs so a hostile/large
 * value cannot stall the sync.
 */
export function retryAfterMs(header: string | null, maxMs: number, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && String(seconds) === header.trim()) {
    return Math.min(Math.max(0, seconds * 1000), maxMs);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(0, dateMs - now), maxMs);
  }
  return null;
}
