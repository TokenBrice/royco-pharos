import { runRoycoPharosD1Sync, type D1SyncMode, type RoycoPharosD1SyncEnv } from "../src/lib/roycopharos/d1-sync";

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

function authorized(request: Request, env: RoycoPharosD1SyncEnv) {
  if (!env.SYNC_ADMIN_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.SYNC_ADMIN_TOKEN}`;
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

  async fetch(request: Request, env: RoycoPharosD1SyncEnv) {
    if (request.method !== "POST") {
      return Response.json({ ok: true, service: "roycopharos-sync" });
    }

    if (!authorized(request, env)) {
      return Response.json({ ok: false, error: "Manual sync is not authorized." }, { status: 401 });
    }

    try {
      const result = await runRoycoPharosD1Sync(env, modeFromUrl(request));
      return Response.json({ ok: true, ...result });
    } catch (error) {
      return Response.json({ ok: false, error: errorMessage(error) }, { status: 500 });
    }
  },
};
