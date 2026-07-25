// Config persistence.
//
// Previously backed by @vercel/kv. Now a JSON file on a mounted disk so the app
// can run anywhere (Railway volume, plain container, local dev) with no vendor
// coupling. Writes are serialised and atomic (temp file + rename) so a crash or
// two concurrent admin saves can't leave a half-written config behind.
//
// Storage layout:
//   $DATA_DIR/config.json        <- live state (on the persistent volume)
//   ./data/config.seed.json      <- committed seed, used only on first boot

import fs from "fs/promises"
import path from "path"
import { trackConfig } from "@/lib/track-config"
import { generateChangeDescription } from "@/lib/change-description"

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data")
const CONFIG_FILE = path.join(DATA_DIR, "config.json")
const SEED_FILE = path.join(process.cwd(), "data", "config.seed.json")
const MAX_CHANGELOG_ENTRIES = 50

export interface ConfigData {
  config: any
  lastModified: string
  changeLog: Array<{
    timestamp: string
    action: string
    details: string
    adminId?: string
  }>
}

/** Used only when the disk is unwritable, so the app degrades instead of erroring. */
let memoryFallback: ConfigData | null = null
let persistenceAvailable: boolean | null = null

/** Serialises writes; read-modify-write must not interleave. */
let writeQueue: Promise<unknown> = Promise.resolve()

const parseConfigData = (raw: string): ConfigData | null => {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object" || !parsed.config) return null
  return {
    config: parsed.config,
    lastModified: parsed.lastModified || new Date().toISOString(),
    changeLog: Array.isArray(parsed.changeLog) ? parsed.changeLog : [],
  }
}

const readJsonFile = async (file: string): Promise<ConfigData | null> => {
  try {
    return parseConfigData(await fs.readFile(file, "utf8"))
  } catch {
    return null
  }
}

/**
 * Distinguish "no config yet" from "config present but unreadable". Conflating the
 * two would let a truncated write silently revert live data to the seed.
 */
const readLiveConfig = async (): Promise<{ data: ConfigData | null; corrupt: boolean }> => {
  let raw: string
  try {
    raw = await fs.readFile(CONFIG_FILE, "utf8")
  } catch {
    return { data: null, corrupt: false } // genuinely absent — first boot
  }

  try {
    const data = parseConfigData(raw)
    return data ? { data, corrupt: false } : { data: null, corrupt: true }
  } catch {
    return { data: null, corrupt: true }
  }
}

/** Move an unreadable config aside so it can be recovered by hand, never overwritten. */
const quarantine = async (): Promise<void> => {
  const target = `${CONFIG_FILE}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`
  try {
    await fs.rename(CONFIG_FILE, target)
    console.error(`[config] ${CONFIG_FILE} was unreadable; preserved at ${target} and re-seeding`)
  } catch (error) {
    console.error(`[config] ${CONFIG_FILE} was unreadable and could not be preserved:`, error)
  }
}

const defaults = (): ConfigData => ({
  config: trackConfig,
  lastModified: new Date().toISOString(),
  changeLog: [],
})

/** Write atomically: temp file in the same directory, then rename over the target. */
const writeAtomic = async (data: ConfigData): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const temp = `${CONFIG_FILE}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8")
  await fs.rename(temp, CONFIG_FILE)
}

/**
 * Load current state, seeding the volume on first boot.
 *
 * Seed order matters: the committed seed holds the real production data, which has
 * diverged from lib/track-config.ts. Falling straight through to trackConfig would
 * silently revert live classifications, so the seed is preferred.
 */
const load = async (): Promise<ConfigData> => {
  const { data: existing, corrupt } = await readLiveConfig()
  if (existing) {
    persistenceAvailable = true
    return existing
  }
  if (corrupt) await quarantine()

  const fromSeed = await readJsonFile(SEED_FILE)
  const seeded = fromSeed ?? defaults()

  try {
    await writeAtomic(seeded)
    persistenceAvailable = true
    console.log(`[config] initialised ${CONFIG_FILE} from ${fromSeed ? "seed" : "defaults"}`)
  } catch (error) {
    persistenceAvailable = false
    memoryFallback = seeded
    console.error(`[config] ${DATA_DIR} is not writable; changes will NOT persist:`, error)
  }

  return seeded
}

export const readConfig = async (): Promise<ConfigData & { isPersistenceEnabled: boolean }> => {
  if (memoryFallback && persistenceAvailable === false) {
    return { ...memoryFallback, isPersistenceEnabled: false }
  }
  const data = await load()
  return { ...data, isPersistenceEnabled: persistenceAvailable === true }
}

export const writeConfig = async (update: {
  config: any
  adminId: string
  action: string
  changeDetails?: string
}): Promise<ConfigData> => {
  // Chain onto the queue so concurrent saves apply one after another.
  const run = writeQueue.then(async () => {
    const { config: newConfig, adminId, action, changeDetails } = update
    const lastModified = new Date().toISOString()

    const current =
      memoryFallback && persistenceAvailable === false ? memoryFallback : await load()

    const details = changeDetails || generateChangeDescription(current.config, newConfig).join("; ")
    const logEntry = { timestamp: lastModified, action, details, adminId }
    const next: ConfigData = {
      config: newConfig,
      lastModified,
      changeLog: [logEntry, ...current.changeLog].slice(0, MAX_CHANGELOG_ENTRIES),
    }

    try {
      await writeAtomic(next)
      persistenceAvailable = true
      memoryFallback = null
    } catch (error) {
      persistenceAvailable = false
      memoryFallback = next
      console.error("[config] write failed; holding change in memory only:", error)
      throw new Error(`Failed to persist configuration to ${DATA_DIR}`)
    }

    return next
  })

  // Keep the queue alive even if this write rejected.
  writeQueue = run.catch(() => {})
  return run
}

/** Diagnostics for the admin panel. */
export const storeStatus = async () => {
  let dataDirectoryExists = false
  let dataDirectoryWritable = false
  let configFileExists = false

  try {
    await fs.access(DATA_DIR)
    dataDirectoryExists = true
  } catch {}

  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const probe = path.join(DATA_DIR, `.write-probe-${process.pid}`)
    await fs.writeFile(probe, "ok", "utf8")
    await fs.unlink(probe)
    dataDirectoryExists = true
    dataDirectoryWritable = true
  } catch {}

  try {
    await fs.access(CONFIG_FILE)
    configFileExists = true
  } catch {}

  return {
    dataDir: DATA_DIR,
    configFile: CONFIG_FILE,
    dataDirectoryExists,
    dataDirectoryWritable,
    configFileExists,
    isPersistenceEnabled: dataDirectoryWritable,
    serverTime: new Date().toISOString(),
  }
}
