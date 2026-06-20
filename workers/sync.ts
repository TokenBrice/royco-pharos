import {
  runRoycoPharosD1Sync,
  startRoycoPharosD1Sync,
  type D1SyncMode,
  type RoycoPharosD1SyncEnv,
} from "../src/lib/roycopharos/d1-sync";

type ScheduledControllerLike = {
  cron?: string;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

function modeFromUrl(request: Request): D1SyncMode {
  const mode = new URL(request.url).searchParams.get("mode");
  return mode === "royco" || mode === "pharos" ? mode : "all";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function authorized(request: Request, env: RoycoPharosD1SyncEnv) {
  if (!env.SYNC_ADMIN_TOKEN) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return timingSafeTokenEqual(supplied, env.SYNC_ADMIN_TOKEN);
}

async function timingSafeTokenEqual(supplied: string, expected: string) {
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return (crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean }).timingSafeEqual(
    suppliedHash,
    expectedHash,
  );
}

export default {
  async scheduled(controller: ScheduledControllerLike, env: RoycoPharosD1SyncEnv, ctx: ExecutionContextLike) {
    ctx.waitUntil(
      runRoycoPharosD1Sync(env)
        .then((result) => {
          console.log(JSON.stringify({ event: "roycopharos_sync_completed", cron: controller.cron ?? null, ...result }));
        })
        .catch((error) => {
          console.error(JSON.stringify({ event: "roycopharos_sync_failed", cron: controller.cron ?? null, error: errorMessage(error) }));
        }),
    );
  },

  async fetch(request: Request, env: RoycoPharosD1SyncEnv, ctx: ExecutionContextLike) {
    if (request.method !== "POST") {
      return Response.json({ ok: true, service: "roycopharos-sync" });
    }

    if (!(await authorized(request, env))) {
      return Response.json({ ok: false, error: "Manual sync is not authorized." }, { status: 401 });
    }

    try {
      const mode = modeFromUrl(request);
      const started = await startRoycoPharosD1Sync(env, mode);
      if (!started.started) {
        return Response.json({ ok: false, ...started.result }, { status: 409 });
      }
      ctx.waitUntil(
        started.promise
          .then((result) => {
            console.log(JSON.stringify({ event: "roycopharos_manual_sync_completed", mode, ...result }));
          })
          .catch((error) => {
            console.error(JSON.stringify({ event: "roycopharos_manual_sync_failed", mode, error: errorMessage(error) }));
          }),
      );
      return Response.json({ ok: true, accepted: true, mode }, { status: 202 });
    } catch (error) {
      return Response.json({ ok: false, error: errorMessage(error) }, { status: 500 });
    }
  },
};
