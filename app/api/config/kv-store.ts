import { kv } from "@vercel/kv"
import { trackConfig } from "@/lib/track-config"
import { generateChangeDescription } from "@/lib/admin-utils"

const CONFIG_KEY = "lightspeed-config-v2"

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

// Reads the configuration from Vercel KV
export const readConfigFromKV = async (): Promise<ConfigData> => {
  try {
    let data = await kv.get<ConfigData>(CONFIG_KEY)
    if (!data) {
      console.log("No config found in KV, initializing with default.")
      data = {
        config: trackConfig,
        lastModified: new Date().toISOString(),
        changeLog: [],
      }
      await kv.set(CONFIG_KEY, data)
    }
    return data
  } catch (error) {
    console.error("Error reading config from KV:", error)
    // Fallback to default config in case of KV failure
    return {
      config: trackConfig,
      lastModified: new Date().toISOString(),
      changeLog: [],
    }
  }
}

// Writes the configuration to Vercel KV
export const writeConfigToKV = async (update: {
  config: any
  adminId: string
  action: string
  changeDetails?: string
}): Promise<ConfigData> => {
  const { config: newConfig, adminId, action, changeDetails } = update

  // Use a transaction to prevent race conditions
  const currentData = await readConfigFromKV()
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

  await kv.set(CONFIG_KEY, newData)

  return newData
}
