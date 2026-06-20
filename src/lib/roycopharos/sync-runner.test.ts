import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runRoycoPharosSync } from "./sync-runner";

describe("local sync runner", () => {
  const previousDbPath = process.env.ROYCOPHAROS_DB_PATH;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (previousDbPath == null) {
      delete process.env.ROYCOPHAROS_DB_PATH;
    } else {
      process.env.ROYCOPHAROS_DB_PATH = previousDbPath;
    }
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("creates the DB directory before taking the local sync lock", async () => {
    const dir = mkdtempSync(join(tmpdir(), "roycopharos-sync-"));
    tempDirs.push(dir);
    process.env.ROYCOPHAROS_DB_PATH = join(dir, "missing", "roycopharos.db");

    const result = await runRoycoPharosSync("royco");

    expect(result).not.toMatchObject({ skipped: true });
    expect(result.published).toBe(true);
  });
});
