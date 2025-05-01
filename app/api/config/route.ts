import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { trackConfig } from "@/lib/track-config"

// Path to our configuration file
const configFilePath = path.join(process.cwd(), "data", "config.json")

// Ensure the data directory exists
const ensureDirectoryExists = () => {
  const dir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Initialize the config file if it doesn't exist
const initConfigFile = () => {
  ensureDirectoryExists()
  if (!fs.existsSync(configFilePath)) {
    fs.writeFileSync(configFilePath, JSON.stringify(trackConfig, null, 2))
  }
}

// Get the current configuration
export async function GET() {
  try {
    initConfigFile()
    const configData = fs.readFileSync(configFilePath, "utf8")
    return NextResponse.json(JSON.parse(configData))
  } catch (error) {
    console.error("Error reading config:", error)
    // If there's an error, return the default config
    return NextResponse.json(trackConfig)
  }
}

// Update the configuration
export async function POST(request: Request) {
  try {
    ensureDirectoryExists()
    const newConfig = await request.json()
    fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2))
    return NextResponse.json({ success: true, message: "Configuration updated successfully" })
  } catch (error) {
    console.error("Error updating config:", error)
    return NextResponse.json({ success: false, message: "Failed to update configuration" }, { status: 500 })
  }
}
