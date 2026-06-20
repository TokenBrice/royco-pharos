import { getMethodology, getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";
import { CACHE, handleApiError, jsonOk } from "../_responses";

export async function GET() {
  try {
    const [methodology, snapshot] = await Promise.all([getMethodology(), getRoycoPharosSnapshot()]);
    return jsonOk(
      {
        data: methodology,
        _meta: snapshot.meta,
      },
      CACHE.methodology,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
