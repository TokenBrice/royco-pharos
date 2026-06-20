import { NextResponse } from "next/server";
import { getRoycoPharosSnapshot, getTrancheHistory } from "@/lib/roycopharos/repository";

export async function GET(request: Request, { params }: { params: Promise<{ trancheId: string }> }) {
  const { trancheId } = await params;
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays) ? Math.min(30, Math.max(1, requestedDays)) : 30;
  const decodedTrancheId = decodeURIComponent(trancheId);
  const [snapshot, history] = await Promise.all([getRoycoPharosSnapshot(), getTrancheHistory(decodedTrancheId, days)]);
  if (!history) {
    return NextResponse.json({ error: "tranche_not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      data: {
        trancheId: decodedTrancheId,
        days,
        apy: history.apy,
        tvl: history.tvl,
      },
      _meta: snapshot.meta,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
