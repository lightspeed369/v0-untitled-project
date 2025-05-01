import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { trackConfig } from "@/lib/track-config"
import { getConfig, setConfig } from "./memory-store"

// Path to our configuration file
const configFilePath = path.join(process.cwd(), "data", "config.json")
let useMemoryStore = false

// Ensure the data directory exists
const ensureDirectoryExists = () => {
  const dir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      console.log("Data directory created successfully")
    } catch (error) {
      console.error("Error creating data directory:", error)
      useMemoryStore = true
    }
  }
}

// Initialize the config file if it doesn't exist
const initConfigFile = () => {
  try {
    ensureDirectoryExists()
    if (useMemoryStore) return

    if (!fs.existsSync(configFilePath)) {
      fs.writeFileSync(configFilePath, JSON.stringify(trackConfig, null, 2))
      console.log("Config file initialized successfully")
    }
  } catch (error) {
    console.error("Error initializing config file:", error)
    useMemoryStore = true
  }
}

// Get the current configuration
export async function GET() {
  try {
    if (!useMemoryStore) {
      initConfigFile()
      try {
        const configData = fs.readFileSync(configFilePath, "utf8")
        return NextResponse.json(JSON.parse(configData))
      } catch (error) {
        console.error("Error reading config file, falling back to memory store:", error)
        useMemoryStore = true
      }
    }

    // Use memory store if file access failed
    if (useMemoryStore) {
      return NextResponse.json(getConfig())
    }

    // Fallback to default config
    return NextResponse.json(trackConfig)
  } catch (error) {
    console.error("Error reading config:", error)
    // If there's an error, return the default config
    return NextResponse.json(trackConfig)
  }
}

// Update the configuration
export async function POST(request: Request) {
  try {
    const newConfig = await request.json()

    if (!useMemoryStore) {
      ensureDirectoryExists()

      // Check if the directory is writable
      try {
        fs.accessSync(path.join(process.cwd(), "data"), fs.constants.W_OK)
        console.log("Data directory is writable")

        // Write the config file
        fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2))
        console.log("Configuration updated successfully in file")

        return NextResponse.json({ success: true, message: "Configuration updated successfully" })
      } catch (error) {
        console.error("Data directory is not writable, falling back to memory store:", error)
        useMemoryStore = true
      }
    }

    // Use memory store if file access failed
    if (useMemoryStore) {
      const success = setConfig(newConfig)
      if (success) {
        console.log("Configuration updated successfully in memory")
        return NextResponse.json({ success: true, message: "Configuration updated successfully (in-memory)" })
      }
    }

    throw new Error("Failed to update configuration in both file system and memory")
  } catch (error) {
    console.error("Error updating config:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update configuration", error: String(error) },
      { status: 500 },
    )
  }
}
