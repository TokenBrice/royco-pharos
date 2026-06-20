import { describe, expect, it, vi } from "vitest";
import { GET as healthGET } from "./health/route";
import { GET as historyGET } from "./history/tranche/[trancheId]/route";
import { GET as marketGET } from "./markets/[marketKey]/route";
import { GET as tranchesGET } from "./tranches/route";
import {
  getHealth,
  getRoycoPharosSnapshot,
  getTrancheHistoryWithMeta,
  SnapshotUnavailableError,
} from "@/lib/roycopharos/repository";

vi.mock("@/lib/roycopharos/repository", () => {
  class SnapshotUnavailableError extends Error {
    constructor(message = "missing") {
      super(message);
      this.name = "SnapshotUnavailableError";
    }
  }
  return {
    SnapshotUnavailableError,
    getHealth: vi.fn(),
    getRoycoPharosSnapshot: vi.fn(),
    getTrancheHistoryWithMeta: vi.fn(),
    getMethodology: vi.fn(() => ({ version: "test" })),
  };
});

const mockedSnapshot = vi.mocked(getRoycoPharosSnapshot);
const mockedHealth = vi.mocked(getHealth);
const mockedHistory = vi.mocked(getTrancheHistoryWithMeta);

describe("API route contracts", () => {
  it("returns snapshot_unavailable as a structured 503", async () => {
    mockedSnapshot.mockRejectedValueOnce(new SnapshotUnavailableError("No published snapshot."));

    const response = await tranchesGET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "snapshot_unavailable",
      message: "No published snapshot.",
    });
  });

  it("returns market_not_found as a structured 404", async () => {
    mockedSnapshot.mockResolvedValueOnce(
      { markets: [], tranches: [], meta: apiMeta() } as unknown as Awaited<ReturnType<typeof getRoycoPharosSnapshot>>,
    );

    const response = await marketGET(new Request("https://example.test/api/markets/missing"), {
      params: Promise.resolve({ marketKey: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "market_not_found" });
  });

  it("returns health JSON with 503 when health is not ok", async () => {
    mockedHealth.mockResolvedValueOnce(
      { ok: false, degraded: true, error: "snapshot_unavailable" } as unknown as Awaited<ReturnType<typeof getHealth>>,
    );

    const response = await healthGET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "snapshot_unavailable" });
  });

  it("clamps history days and returns targeted meta", async () => {
    mockedHistory.mockResolvedValueOnce({
      meta: apiMeta(),
      history: { apy: [], tvl: [] },
    });

    const response = await historyGET(new Request("https://example.test/api/history/tranche/t1?days=100"), {
      params: Promise.resolve({ trancheId: "t1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { trancheId: "t1", days: 30, apy: [], tvl: [] },
      _meta: apiMeta(),
    });
  });
});

function apiMeta() {
  const block = {
    ageSeconds: 0,
    status: "fresh" as const,
    warning: null,
  };
  return {
    royco: block,
    pharos: block,
    score: block,
  };
}
