import fs from "fs/promises"
import path from "path"
import { trackConfig } from "@/lib/track-config"
import { generateChangeDescription } from "@/lib/admin-utils"

const dataDir = path.join(process.cwd(), "data")
const configFile = path.join(dataDir, "config.json")

interface ConfigData {
  config: any
  lastModified: string
  changeLog: Array<{
    timestamp: string
    action: string
    details: string
    adminId?: string
  }>
}

// Ensures the data directory and config file exist
const initializeConfig = async (): Promise<ConfigData> => {
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch (error) {
    console.error("Error creating data directory:", error)
    throw new Error("Could not create data directory.")
  }

  try {
    await fs.access(configFile)
  } catch (error) {
    // File doesn't exist, so create it with default values
    console.log("config.json not found, creating with default configuration.")
    const initialData: ConfigData = {
      config: trackConfig,
      lastModified: new Date().toISOString(),
      changeLog: [],
    }
    await fs.writeFile(configFile, JSON.stringify(initialData, null, 2), "utf-8")
    return initialData
  }

  // If we reach here, the file exists, so we can read it
  const fileContents = await fs.readFile(configFile, "utf-8")
  return JSON.parse(fileContents)
}

// Reads the configuration from the file
export const readConfigFromFile = async (): Promise<ConfigData> => {
  try {
    return await initializeConfig()
  } catch (error: any) {
    console.error("Error reading config from file:", error)
    // Fallback to default config in case of catastrophic failure
    return {
      config: trackConfig,
      lastModified: new Date().toISOString(),
      changeLog: [],
    }
  }
}

// Writes the configuration to the file
export const writeConfigToFile = async (update: {
  config: any
  adminId: string
  action: string
  changeDetails?: string
}): Promise<ConfigData> => {
  const { config: newConfig, adminId, action, changeDetails } = update

  // Lock mechanism could be implemented here for high-concurrency environments

  const currentData = await readConfigFromFile()
  const oldConfig = currentData.config

  const lastModified = new Date().toISOString()

  // Generate detailed change description if not provided
  const details = changeDetails || generateChangeDescription(oldConfig, newConfig).join("; ")

  const logEntry = {
    timestamp: lastModified,
    action,
    details: details || `Configuration updated by ${adminId}`,
    adminId,
  }

  const newChangeLog = [logEntry, ...currentData.changeLog].slice(0, 50)

  const newData: ConfigData = {
    config: newConfig,
    lastModified,
    changeLog: newChangeLog,
  }

  await fs.writeFile(configFile, JSON.stringify(newData, null, 2), "utf-8")

  return newData
}
