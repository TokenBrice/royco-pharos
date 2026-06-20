import { NextResponse } from "next/server";
import { getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";

export async function GET() {
  const snapshot = await getRoycoPharosSnapshot();
  return NextResponse.json(
    {
      data: snapshot.markets,
      _meta: snapshot.meta,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=240",
      },
    },
  );
}
