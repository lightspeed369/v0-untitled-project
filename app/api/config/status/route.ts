import { NextResponse } from "next/server"
import { storeStatus } from "../store"

// Reports where config is stored and whether that location is writable.
// The previous version probed a hardcoded ./data path that the KV-backed store
// never used, so it always reported failure regardless of actual health.
export async function GET() {
  return NextResponse.json(await storeStatus())
}
