import { getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";
import { CACHE, handleApiError, jsonError, jsonOk } from "../../_responses";

export async function GET(_request: Request, { params }: { params: Promise<{ marketKey: string }> }) {
  try {
    const { marketKey } = await params;
    const snapshot = await getRoycoPharosSnapshot();
    const decodedMarketKey = decodeURIComponent(marketKey);
    const market = snapshot.markets.find((entry) => entry.marketKey === decodedMarketKey) ?? null;
    if (!market) {
      return jsonError("market_not_found", 404);
    }
    return jsonOk(
      {
        data: market,
        _meta: snapshot.meta,
      },
      CACHE.short,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
