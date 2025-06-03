import { NextResponse } from "next/server"
import { trackConfig } from "@/lib/track-config"

// Simple in-memory store for configuration
let globalConfig = { ...trackConfig }

// Get the current configuration
export async function GET() {
  try {
    return NextResponse.json(globalConfig)
  } catch (error) {
    console.error("Error reading config:", error)
    return NextResponse.json(trackConfig)
  }
}

// Update the configuration
export async function POST(request: Request) {
  try {
    const newConfig = await request.json()

    // Update the global configuration
    globalConfig = { ...newConfig }

    console.log("Configuration updated successfully")
    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error updating config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration", error: String(error) },
      { status: 500 },
    )
  }
}
