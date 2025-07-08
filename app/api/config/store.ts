import { kv } from "@vercel/kv"
import { trackConfig } from "@/lib/track-config"
import { generateChangeDescription } from "@/lib/admin-utils"

// --- In-Memory Fallback Store ---
let memoryStore = {
  config: { ...trackConfig },
  lastModified: new Date().toISOString(),
  changeLog: [],
}

// --- KV Store Configuration ---
const CONFIG_KEY = "lightspeed-config-v2"
const isKVEnabled = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN

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

// --- Unified Read Function ---
export const readConfig = async (): Promise<ConfigData & { isPersistenceEnabled: boolean }> => {
  if (isKVEnabled) {
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
      return { ...data, isPersistenceEnabled: true }
    } catch (error) {
      console.error("Error reading config from KV, falling back to in-memory:", error)
      // Fallback to in-memory if KV fails despite being enabled
      return { ...memoryStore, isPersistenceEnabled: false }
    }
  } else {
    // KV is not enabled, use in-memory store
    console.warn("Vercel KV is not configured. Using in-memory store. Changes will not be persisted.")
    return { ...memoryStore, isPersistenceEnabled: false }
  }
}

// --- Unified Write Function ---
export const writeConfig = async (update: {
  config: any
  adminId: string
  action: string
  changeDetails?: string
}): Promise<ConfigData> => {
  const { config: newConfig, adminId, action, changeDetails } = update
  const lastModified = new Date().toISOString()

  if (isKVEnabled) {
    try {
      const currentData = await readConfigFromKV() // Read latest before writing
      const oldConfig = currentData.config
      const details = changeDetails || generateChangeDescription(oldConfig, newConfig).join("; ")
      const logEntry = { timestamp: lastModified, action, details, adminId }
      const newChangeLog = [logEntry, ...currentData.changeLog].slice(0, 50)
      const newData: ConfigData = { config: newConfig, lastModified, changeLog: newChangeLog }
      await kv.set(CONFIG_KEY, newData)
      return newData
    } catch (error) {
      console.error("Error writing to KV:", error)
      throw new Error("Failed to write to Vercel KV store.")
    }
  } else {
    // KV is not enabled, update in-memory store
    const oldConfig = memoryStore.config
    const details = changeDetails || generateChangeDescription(oldConfig, newConfig).join("; ")
    const logEntry = { timestamp: lastModified, action, details, adminId }
    const newChangeLog = [logEntry, ...memoryStore.changeLog].slice(0, 50)
    memoryStore = { config: newConfig, lastModified, changeLog: newChangeLog }
    return memoryStore
  }
}

// Helper function for internal KV reads to avoid circular logic and returning the persistence flag
const readConfigFromKV = async (): Promise<ConfigData> => {
  const data = await kv.get<ConfigData>(CONFIG_KEY)
  if (!data) {
    return {
      config: trackConfig,
      lastModified: new Date().toISOString(),
      changeLog: [],
    }
  }
  return data
}
