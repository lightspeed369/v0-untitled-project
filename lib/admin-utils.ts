"use client"

import { trackConfig } from "./track-config"
import { generateChangeDescription } from "./change-description"

// Re-exported so existing client imports from this module keep working, while the
// implementation stays in a non-client module the server can also call.
export { generateChangeDescription }

// Function to save configuration to the server
export const saveConfigToServer = async (
  config: any,
  adminId = "admin",
  action = "Configuration updated",
  oldConfig?: any,
) => {
  try {
    console.log("Saving config to server:", config)

    // Generate detailed change description if oldConfig is provided
    let changeDetails = action
    if (oldConfig) {
      const changes = generateChangeDescription(oldConfig, config)
      if (changes.length > 0) {
        changeDetails = changes.join("; ")
      } else {
        changeDetails = "No changes detected, saved with current timestamp."
      }
    }

    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config,
        adminId,
        action,
        changeDetails,
      }),
    })

    const data = await response.json()
    console.log("Server response:", data)

    if (!response.ok) {
      console.error("Server error:", data)
      return { success: false, error: data.message || "Server error" }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error saving config to server:", error)
    return { success: false, error: String(error) }
  }
}

// Function to load configuration from the server
export const loadConfigFromServer = async () => {
  try {
    console.log("Loading config from server...")

    const response = await fetch("/api/config", {
      cache: "no-store", // Ensure we always get fresh data
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `Failed to fetch configuration: ${response.status}`)
    }

    const data = await response.json()
    console.log("Loaded data from server:", data)
    return data // This now returns { config, lastModified, changeLog, isPersistenceEnabled }
  } catch (error) {
    console.error("Error loading config from server:", error)
    return null
  }
}

// Function to save configuration to localStorage (as backup)
export const saveConfigToStorage = (config: any, lastModified?: string) => {
  try {
    const dataToSave = {
      config,
      lastModified: lastModified || new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem("trackConfig", JSON.stringify(dataToSave))
    return true
  } catch (error) {
    console.error("Error saving config to localStorage:", error)
    return false
  }
}

// Function to load configuration from localStorage
export const loadConfigFromStorage = () => {
  try {
    const savedData = localStorage.getItem("trackConfig")
    if (savedData) {
      const parsed = JSON.parse(savedData)
      return parsed.config ? parsed : { config: parsed, lastModified: new Date().toISOString() }
    }
    return null
  } catch (error) {
    console.error("Error loading config from localStorage:", error)
    return null
  }
}

// Function to get the current configuration (from server or default)
export const getCurrentConfig = async () => {
  console.log("Getting current config...")

  const serverData = await loadConfigFromServer()
  if (serverData && serverData.config) {
    console.log("Using server config")
    // Save to localStorage as a backup
    saveConfigToStorage(serverData.config, serverData.lastModified)
    return serverData // This will now include `isPersistenceEnabled`
  }

  console.log("Server config failed, trying localStorage...")
  // If server fetch fails, try localStorage
  const localData = loadConfigFromStorage()
  if (localData && localData.config) {
    console.log("Using local config")
    return {
      config: localData.config,
      lastModified: localData.lastModified || new Date().toISOString(),
      changeLog: [],
      isPersistenceEnabled: false, // Local storage is not the desired persistent state
    }
  }

  console.log("Using default config")
  return {
    config: trackConfig,
    lastModified: new Date().toISOString(),
    changeLog: [],
    isPersistenceEnabled: false, // Default config is not persistent
  }
}

// Function to extract points from a modification string
export const extractPointsFromMod = (mod: string) => {
  const match = mod.match(/$$(-?\d+)$$$/)
  if (match && match[1]) {
    return Number.parseInt(match[1], 10)
  }
  return 0
}

// Function to extract name from a modification string
export const extractNameFromMod = (mod: string) => {
  const lastParenIndex = mod.lastIndexOf("(")
  if (lastParenIndex > 0) {
    return mod.substring(0, lastParenIndex).trim()
  }
  return mod
}

// Function to create a modification string with points
export const createModString = (name: string, points: number) => {
  return `${name} (${points})`
}

// Function to parse a base class with special indicators
export const parseBaseClass = (baseClass: string) => {
  const hasAsterisk = baseClass.includes("*")
  const hasDollar = baseClass.includes("$")
  const cleanClass = baseClass.replace(/[*$]/g, "")

  return {
    class: cleanClass,
    hasAsterisk,
    hasDollar,
  }
}

// Function to format a base class with special indicators
export const formatBaseClass = (baseClass: string, hasAsterisk: boolean, hasDollar: boolean) => {
  let result = baseClass
  if (hasAsterisk) result += "*"
  if (hasDollar) result += "$"
  return result
}

// Function to broadcast configuration changes
export const broadcastConfigChange = (config: any, lastModified?: string) => {
  console.log("Broadcasting config change:", config)
  // Create a custom event to notify other components about the config change
  const event = new CustomEvent("configUpdated", {
    detail: {
      config,
      lastModified: lastModified || new Date().toISOString(),
    },
  })
  window.dispatchEvent(event)
}
