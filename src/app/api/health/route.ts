import { NextResponse } from "next/server";
import { getHealth } from "@/lib/roycopharos/repository";

export async function GET() {
  return NextResponse.json(await getHealth(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
