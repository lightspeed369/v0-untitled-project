"use client"

import { trackConfig } from "./track-config"

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
    return data
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
    return serverData
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
    }
  }

  console.log("Using default config")
  return {
    config: trackConfig,
    lastModified: new Date().toISOString(),
    changeLog: [],
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

// Function to compare configurations and generate detailed change descriptions
export const generateChangeDescription = (oldConfig: any, newConfig: any) => {
  const changes: string[] = []

  if (!oldConfig || !newConfig) return ["Initial configuration setup."]

  // Compare models (makes and models)
  const oldMakes = Object.keys(oldConfig.models || {})
  const newMakes = Object.keys(newConfig.models || {})

  // Check for added makes
  const addedMakes = newMakes.filter((make) => !oldMakes.includes(make))
  addedMakes.forEach((make) => {
    changes.push(`Added make: ${make}`)
  })

  // Check for removed makes
  const removedMakes = oldMakes.filter((make) => !newMakes.includes(make))
  removedMakes.forEach((make) => {
    changes.push(`Removed make: ${make}`)
  })

  // Check for changes within existing makes
  const commonMakes = oldMakes.filter((make) => newMakes.includes(make))
  commonMakes.forEach((make) => {
    const oldModels = Object.keys(oldConfig.models[make] || {})
    const newModels = Object.keys(newConfig.models[make] || {})

    // Check for added models
    const addedModels = newModels.filter((model) => !oldModels.includes(model))
    addedModels.forEach((model) => {
      const baseClass = newConfig.models[make][model]?.baseClass || "Unknown"
      changes.push(`Added model: ${make} ${model} (${baseClass})`)
    })

    // Check for removed models
    const removedModels = oldModels.filter((model) => !newModels.includes(model))
    removedModels.forEach((model) => {
      changes.push(`Removed model: ${make} ${model}`)
    })

    // Check for modified models
    const commonModels = oldModels.filter((model) => newModels.includes(model))
    commonModels.forEach((model) => {
      const oldBaseClass = oldConfig.models[make][model]?.baseClass
      const newBaseClass = newConfig.models[make][model]?.baseClass
      if (oldBaseClass !== newBaseClass) {
        changes.push(`Modified model: ${make} ${model} (${oldBaseClass} → ${newBaseClass})`)
      }
    })
  })

  // Compare modification categories
  const oldCategories = Object.keys(oldConfig.scoreLookupTable || {})
  const newCategories = Object.keys(newConfig.scoreLookupTable || {})

  // Check for added categories
  const addedCategories = newCategories.filter((cat) => !oldCategories.includes(cat))
  addedCategories.forEach((category) => {
    changes.push(`Added category: ${category}`)
  })

  // Check for removed categories
  const removedCategories = oldCategories.filter((cat) => !newCategories.includes(cat))
  removedCategories.forEach((category) => {
    changes.push(`Removed category: ${category}`)
  })

  // Check for changes within existing categories
  const commonCategories = oldCategories.filter((cat) => newCategories.includes(cat))
  commonCategories.forEach((category) => {
    const oldMods = oldConfig[category] || []
    const newMods = newConfig[category] || []

    // Check for added modifications
    const addedMods = newMods.filter((mod: string) => !oldMods.includes(mod))
    addedMods.forEach((mod: string) => {
      const points = newConfig.scoreLookupTable[category]?.[mod] ?? "N/A"
      changes.push(`Added mod to ${category}: ${mod} (${points} pts)`)
    })

    // Check for removed modifications
    const removedMods = oldMods.filter((mod: string) => !newMods.includes(mod))
    removedMods.forEach((mod: string) => {
      changes.push(`Removed mod from ${category}: ${mod}`)
    })

    // Check for modified modifications (point changes)
    const commonMods = oldMods.filter((mod: string) => newMods.includes(mod))
    commonMods.forEach((mod: string) => {
      const oldPoints = oldConfig.scoreLookupTable[category]?.[mod]
      const newPoints = newConfig.scoreLookupTable[category]?.[mod]
      if (oldPoints !== newPoints) {
        changes.push(`Modified mod in ${category}: ${mod} (${oldPoints} → ${newPoints} pts)`)
      }
    })
  })

  return changes
}
