import { NextResponse } from "next/server"
import { readConfigFromFile, writeConfigToFile } from "./fs-store"

// Get the current configuration from the file
export async function GET() {
  try {
    const { config, lastModified, changeLog } = await readConfigFromFile()
    return NextResponse.json({ config, lastModified, changeLog })
  } catch (error: any) {
    console.error("Error reading config from file in GET:", error)
    return NextResponse.json(
      { success: false, message: "Failed to read configuration", error: error.message },
      { status: 500 },
    )
  }
}

// Update the configuration in the file
export async function POST(request: Request) {
  try {
    const {
      config: newConfig,
      adminId = "admin",
      action = "Configuration updated",
      changeDetails,
    } = await request.json()

    const updatedData = await writeConfigToFile({
      config: newConfig,
      adminId,
      action,
      changeDetails,
    })

    console.log("Configuration updated successfully by:", adminId)

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      timestamp: updatedData.lastModified,
      changeLog: updatedData.changeLog,
    })
  } catch (error: any) {
    console.error("Error updating config in POST:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration", error: error.message },
      { status: 500 },
    )
  }
}
