import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readConfig, writeConfig } from "./store"
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth"

// Reading the config is public: the calculator itself is public and needs it.
export async function GET() {
  try {
    const { config, lastModified, changeLog, isPersistenceEnabled } = await readConfig()
    return NextResponse.json({ config, lastModified, changeLog, isPersistenceEnabled })
  } catch (error: any) {
    console.error("Error in GET /api/config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to read configuration.", error: error.message },
      { status: 500 },
    )
  }
}

// Writing requires an admin session. This endpoint used to accept anonymous
// writes, which let anyone overwrite the live classification data.
export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access is not configured on this server. Set the ADMIN_PASSWORD environment variable.",
      },
      { status: 503 },
    )
  }

  const store = await cookies()
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { success: false, message: "Not authenticated. Log in to the admin panel first." },
      { status: 401 },
    )
  }

  try {
    const {
      config: newConfig,
      adminId = "admin",
      action = "Configuration updated",
      changeDetails,
    } = await request.json()

    if (!newConfig || typeof newConfig !== "object") {
      return NextResponse.json({ success: false, message: "No configuration data provided." }, { status: 400 })
    }

    // Guard against a truncated or malformed payload wiping the vehicle table.
    if (!newConfig.models || typeof newConfig.models !== "object" || Object.keys(newConfig.models).length === 0) {
      return NextResponse.json(
        { success: false, message: "Refusing to save: configuration contains no vehicle models." },
        { status: 400 },
      )
    }

    const updatedData = await writeConfig({ config: newConfig, adminId, action, changeDetails })

    console.log("Configuration updated by:", adminId)

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      timestamp: updatedData.lastModified,
      changeLog: updatedData.changeLog,
    })
  } catch (error: any) {
    console.error("Error in POST /api/config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration.", error: error.message },
      { status: 500 },
    )
  }
}
