"use client"

import { trackConfig } from "./track-config"

// Function to save configuration to localStorage
export const saveConfigToStorage = (config: any) => {
  try {
    localStorage.setItem("trackConfig", JSON.stringify(config))
    return true
  } catch (error) {
    console.error("Error saving config:", error)
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
    console.error("Error loading config:", error)
    return null
  }
}

// Function to get the current configuration (from localStorage or default)
export const getCurrentConfig = () => {
  const savedConfig = loadConfigFromStorage()
  return savedConfig || trackConfig
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
  // Create a custom event to notify other components about the config change
  const event = new CustomEvent("configUpdated", { detail: config })
  window.dispatchEvent(event)
}
