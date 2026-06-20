import { getTrancheHistoryWithMeta } from "@/lib/roycopharos/repository";
import { CACHE, handleApiError, jsonError, jsonOk } from "../../../_responses";

export async function GET(request: Request, { params }: { params: Promise<{ trancheId: string }> }) {
  try {
    const { trancheId } = await params;
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days") ?? 30);
    const days = Number.isFinite(requestedDays) ? Math.min(30, Math.max(1, requestedDays)) : 30;
    const decodedTrancheId = decodeURIComponent(trancheId);
    const { meta, history } = await getTrancheHistoryWithMeta(decodedTrancheId, days);
    if (!history) {
      return jsonError("tranche_not_found", 404);
    }
    return jsonOk(
      {
        data: {
          trancheId: decodedTrancheId,
          days,
          apy: history.apy,
          tvl: history.tvl,
        },
        _meta: meta,
      },
      CACHE.history,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
