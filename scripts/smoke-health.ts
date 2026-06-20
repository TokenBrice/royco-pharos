const input = process.argv[2] ?? process.env.ROYCOPHAROS_HEALTH_URL;

export {};

if (!input) {
  console.error("Usage: npm run smoke:health -- https://<host-or-health-url>");
  console.error("Or set ROYCOPHAROS_HEALTH_URL.");
  process.exit(1);
}

function normalizeHealthUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }
  if (url.pathname === "" || url.pathname === "/") {
    url.pathname = "/api/health";
  }
  return url;
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const url = normalizeHealthUrl(input);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: controller.signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON health response, got ${contentType || "unknown content-type"}`);
  }

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`Health endpoint returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (typeof body !== "object" || body == null || !("ok" in body) || body.ok !== true) {
    throw new Error(`Health endpoint did not report ok: true: ${JSON.stringify(body)}`);
  }

  const generatedAt = "generatedAt" in body ? body.generatedAt : "unknown";
  const trancheCount = "trancheCount" in body ? body.trancheCount : "unknown";
  console.log(`Health smoke passed: ${url.href} generatedAt=${generatedAt} trancheCount=${trancheCount}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Health smoke failed: ${message}`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
