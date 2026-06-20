import { runRoycoPharosSync } from "../src/lib/roycopharos/sync-runner";

const args = new Set(process.argv.slice(2));
const mode = args.has("--royco") ? "royco" : args.has("--pharos") ? "pharos" : "all";

const result = await runRoycoPharosSync(mode);

console.log(
  JSON.stringify(
    {
      mode,
      ...result,
      note: "Local sync completed. Set ROYCO_DAWN_LIVE=1 and PHAROS_API_KEY for live upstream reads.",
    },
    null,
    2,
  ),
);
