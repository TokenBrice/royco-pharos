import { existsSync } from "node:fs";
import { databasePath } from "../src/lib/roycopharos/sqlite";
import { getHealth } from "../src/lib/roycopharos/repository";

const health = await getHealth();

console.log(
  JSON.stringify(
    {
      ...health,
      dbPath: databasePath(),
      dbExists: existsSync(databasePath()),
    },
    null,
    2,
  ),
);
