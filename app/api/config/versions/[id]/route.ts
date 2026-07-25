import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readVersion, restoreVersion } from "../../store"
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth"

const requireAdmin = async () => {
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
  return null
}

/** Inspect a stored version without applying it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  // The id is validated inside readVersion; an unknown or malformed one yields null
  // rather than touching the filesystem.
  const version = await readVersion(id)
  if (!version) {
    return NextResponse.json({ success: false, message: "Version not found." }, { status: 404 })
  }
  return NextResponse.json({ version: version.summary, config: version.config })
}

/** Roll the live configuration back to this version. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params

  let adminId = "admin"
  try {
    const body = await request.json()
    if (typeof body?.adminId === "string" && body.adminId.trim()) adminId = body.adminId.trim()
  } catch {
    // No body is fine; fall back to the default admin label.
  }

  try {
    const restored = await restoreVersion(id, adminId)
    if (!restored) {
      return NextResponse.json({ success: false, message: "Version not found." }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      message: "Configuration restored",
      timestamp: restored.lastModified,
      changeLog: restored.changeLog,
    })
  } catch (error: any) {
    console.error("Error restoring version:", error)
    return NextResponse.json(
      { success: false, message: "Failed to restore version.", error: error.message },
      { status: 500 },
    )
  }
}
