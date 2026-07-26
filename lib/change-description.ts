// Shared config-diff helper.
//
// This deliberately has NO "use client" directive: it is imported by both the
// admin UI (client) and the config API route (server). It previously lived in
// lib/admin-utils.ts, which is a client module, so calling it from the server
// threw "Attempted to call generateChangeDescription() from the server but
// generateChangeDescription is on the client" and turned every write that
// omitted `changeDetails` into a 500.

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
