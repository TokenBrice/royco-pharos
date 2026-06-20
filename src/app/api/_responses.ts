import { NextResponse } from "next/server";
import { SnapshotUnavailableError } from "@/lib/roycopharos/repository";

export const CACHE = {
  health: "no-store",
  short: "s-maxage=60, stale-while-revalidate=240",
  history: "s-maxage=120, stale-while-revalidate=300",
  methodology: "s-maxage=300, stale-while-revalidate=600",
} as const;

export function jsonOk(body: unknown, cacheControl: string, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
    },
  });
}

export function jsonError(error: string, status: number, message?: string) {
  return NextResponse.json(
    {
      error,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof SnapshotUnavailableError) {
    return jsonError("snapshot_unavailable", 503, error.message);
  }
  throw error;
}
