import { NextResponse } from "next/server"
import { readConfig, writeConfig } from "./store"

// Get the current configuration from Vercel KV
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

// Update the configuration in Vercel KV
export async function POST(request: Request) {
  try {
    const {
      config: newConfig,
      adminId = "admin",
      action = "Configuration updated",
      changeDetails,
    } = await request.json()

    if (!newConfig) {
      return NextResponse.json({ success: false, message: "No configuration data provided." }, { status: 400 })
    }

    const updatedData = await writeConfig({
      config: newConfig,
      adminId,
      action,
      changeDetails,
    })

    console.log("Configuration updated successfully in KV by:", adminId)

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      timestamp: updatedData.lastModified,
      changeLog: updatedData.changeLog,
    })
  } catch (error: any) {
    console.error("Error in POST /api/config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration in KV store.", error: error.message },
      { status: 500 },
    )
  }
}
