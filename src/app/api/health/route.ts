import { getHealth } from "@/lib/roycopharos/repository";
import { CACHE, jsonOk } from "../_responses";

export async function GET() {
  const health = await getHealth();
  return jsonOk(health, CACHE.health, health.ok ? 200 : 503);
}
