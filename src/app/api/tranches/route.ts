import { getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";
import { CACHE, handleApiError, jsonOk } from "../_responses";

export async function GET() {
  try {
    const snapshot = await getRoycoPharosSnapshot();
    return jsonOk(
      {
        data: snapshot.tranches,
        _meta: snapshot.meta,
      },
      CACHE.short,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
