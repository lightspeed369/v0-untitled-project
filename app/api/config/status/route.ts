import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  const dataDir = path.join(process.cwd(), "data")
  const configFile = path.join(dataDir, "config.json")

  const status = {
    dataDirectoryExists: false,
    dataDirectoryWritable: false,
    configFileExists: false,
    configFileReadable: false,
    configFileWritable: false,
    serverTime: new Date().toISOString(),
  }

  // Check if data directory exists
  try {
    status.dataDirectoryExists = fs.existsSync(dataDir)
  } catch (error) {
    console.error("Error checking if data directory exists:", error)
  }

  // Check if data directory is writable
  if (status.dataDirectoryExists) {
    try {
      fs.accessSync(dataDir, fs.constants.W_OK)
      status.dataDirectoryWritable = true
    } catch (error) {
      console.error("Error checking if data directory is writable:", error)
    }
  }

  // Check if config file exists
  try {
    status.configFileExists = fs.existsSync(configFile)
  } catch (error) {
    console.error("Error checking if config file exists:", error)
  }

  // Check if config file is readable
  if (status.configFileExists) {
    try {
      fs.accessSync(configFile, fs.constants.R_OK)
      status.configFileReadable = true
    } catch (error) {
      console.error("Error checking if config file is readable:", error)
    }
  }

  // Check if config file is writable
  if (status.configFileExists) {
    try {
      fs.accessSync(configFile, fs.constants.W_OK)
      status.configFileWritable = true
    } catch (error) {
      console.error("Error checking if config file is writable:", error)
    }
  }

  return NextResponse.json(status)
}
