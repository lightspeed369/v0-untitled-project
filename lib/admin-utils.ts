"use client"

import { trackConfig } from "./track-config"

// Function to save configuration to the server
export const saveConfigToServer = async (config: any) => {
  try {
    console.log("Saving config to server:", config)

    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
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
      headers: {
        "Cache-Control": "no-cache",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch configuration: ${response.status} ${response.statusText}`)
    }

    const config = await response.json()
    console.log("Loaded config from server:", config)
    return config
  } catch (error) {
    console.error("Error loading config from server:", error)
    return null
  }
}

// Function to save configuration to localStorage (as backup)
export const saveConfigToStorage = (config: any) => {
  try {
    localStorage.setItem("trackConfig", JSON.stringify(config))
    return true
  } catch (error) {
    console.error("Error saving config to localStorage:", error)
    return false
  }
}

// Function to load configuration from localStorage
export const loadConfigFromStorage = () => {
  try {
    const savedConfig = localStorage.getItem("trackConfig")
    if (savedConfig) {
      return JSON.parse(savedConfig)
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

  const serverConfig = await loadConfigFromServer()
  if (serverConfig) {
    console.log("Using server config")
    // Save to localStorage as a backup
    saveConfigToStorage(serverConfig)
    return serverConfig
  }

  console.log("Server config failed, trying localStorage...")
  // If server fetch fails, try localStorage
  const localConfig = loadConfigFromStorage()
  if (localConfig) {
    console.log("Using local config")
    return localConfig
  }

  console.log("Using default config")
  return trackConfig
}

// Function to extract points from a modification string
export const extractPointsFromMod = (mod: string) => {
  const match = mod.match(/$$(-?\d+)$$/)
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
export const broadcastConfigChange = (config: any) => {
  console.log("Broadcasting config change:", config)
  // Create a custom event to notify other components about the config change
  const event = new CustomEvent("configUpdated", { detail: config })
  window.dispatchEvent(event)
}
