import { NextResponse } from "next/server"
import { trackConfig } from "@/lib/track-config"

// Simple in-memory store for configuration with timestamp
let globalConfig = { ...trackConfig }
let lastModified = new Date().toISOString()
let changeLog: Array<{
  timestamp: string
  action: string
  details: string
  adminId?: string
}> = []

// Get the current configuration
export async function GET() {
  try {
    return NextResponse.json({
      config: globalConfig,
      lastModified,
      changeLog,
    })
  } catch (error) {
    console.error("Error reading config:", error)
    return NextResponse.json({
      config: trackConfig,
      lastModified: new Date().toISOString(),
      changeLog: [],
    })
  }
}

// Update the configuration
export async function POST(request: Request) {
  try {
    const {
      config: newConfig,
      adminId = "admin",
      action = "Configuration updated",
      changeDetails,
    } = await request.json()

    // Update the global configuration
    const previousConfig = JSON.stringify(globalConfig)
    globalConfig = { ...newConfig }
    lastModified = new Date().toISOString()

    // Add to change log with detailed information
    const logEntry = {
      timestamp: lastModified,
      action,
      details: changeDetails || `Configuration updated by ${adminId}`,
      adminId,
      changeDetails: changeDetails || "No specific changes recorded",
    }

    changeLog.unshift(logEntry) // Add to beginning of array

    // Keep only last 50 entries
    if (changeLog.length > 50) {
      changeLog = changeLog.slice(0, 50)
    }

    console.log("Configuration updated successfully by:", adminId)
    console.log("Change log entry added:", logEntry)

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      timestamp: lastModified,
      changeLog,
    })
  } catch (error) {
    console.error("Error updating config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration", error: String(error) },
      { status: 500 },
    )
  }
}
