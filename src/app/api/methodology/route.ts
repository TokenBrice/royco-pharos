import { NextResponse } from "next/server";
import { getMethodology, getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";

export async function GET() {
  const [methodology, snapshot] = await Promise.all([getMethodology(), getRoycoPharosSnapshot()]);
  return NextResponse.json(
    {
      data: methodology,
      _meta: snapshot.meta,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
