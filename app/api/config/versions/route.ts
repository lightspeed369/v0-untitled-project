import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { listVersions } from "../store"
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth"

// Version history is admin data (it records who changed what), so unlike
// GET /api/config this requires a session.
export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { success: false, message: "Admin access is not configured on this server." },
      { status: 503 },
    )
  }

  const store = await cookies()
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 })
  }

  try {
    return NextResponse.json({ versions: await listVersions() })
  } catch (error: any) {
    console.error("Error listing versions:", error)
    return NextResponse.json(
      { success: false, message: "Failed to list versions.", error: error.message },
      { status: 500 },
    )
  }
}
