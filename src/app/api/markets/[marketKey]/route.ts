import { NextResponse } from "next/server";
import { getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ marketKey: string }> }) {
  const { marketKey } = await params;
  const snapshot = await getRoycoPharosSnapshot();
  const decodedMarketKey = decodeURIComponent(marketKey);
  const market = snapshot.markets.find((entry) => entry.marketKey === decodedMarketKey) ?? null;
  if (!market) {
    return NextResponse.json({ error: "market_not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      data: market,
      _meta: snapshot.meta,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=240",
      },
    },
  );
}
