// This is a simple in-memory store for the configuration
// It's used as a fallback when file system access fails

import { trackConfig } from "@/lib/track-config"

let configStore = { ...trackConfig }

export const getConfig = () => {
  return configStore
}

export const setConfig = (newConfig: any) => {
  configStore = { ...newConfig }
  return true
}
