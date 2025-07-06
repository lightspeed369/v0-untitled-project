"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { trackConfig } from "@/lib/track-config"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { useMobile } from "@/hooks/use-mobile"
import { getCurrentConfig } from "@/lib/admin-utils"

export default function TrackClassCalculator() {
  const isMobile = useMobile()
  const resultsRef = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<any>(trackConfig)
  const [lastModified, setLastModified] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  const [make, setMake] = useState<string>("")
  const [model, setModel] = useState<string>("")
  const [baseClass, setBaseClass] = useState<string>("")
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({
    engine: [],
    drivetrain: [],
    suspension: [],
    chassis: [],
    aero: [],
    tires: [],
    "weight-reduction": [],
    electronics: [],
  })
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [baseClassPoints, setBaseClassPoints] = useState<number>(0)
  const [modificationPoints, setModificationPoints] = useState<number>(0)
  const [finalClass, setFinalClass] = useState<string>("")
  const [savedConfigs, setSavedConfigs] = useState<any[]>([])
  const [showResults, setShowResults] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("engine")
  const [tiresError, setTiresError] = useState<boolean>(false)
  const [activeTabSection, setActiveTabSection] = useState<string>("calculator")

  // Submission form states
  const [selectedConfigIndex, setSelectedConfigIndex] = useState<number | null>(null)
  const [firstName, setFirstName] = useState<string>("")
  const [lastName, setLastName] = useState<string>("")
  const [driverEmail, setDriverEmail] = useState<string>("")
  const [carNumber, setCarNumber] = useState<string>("")
  const [team, setTeam] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false)

  // Load configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        console.log("Calculator: Loading configuration...")
        const currentData = await getCurrentConfig()
        console.log("Calculator: Loaded data:", currentData)
        setConfig(currentData.config)
        setLastModified(currentData.lastModified || "")
      } catch (error) {
        console.error("Calculator: Error loading configuration:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load configuration. Using default configuration.",
        })
        setConfig(trackConfig) // Fallback to default config
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()

    // Listen for configuration changes
    const handleConfigUpdate = async (event: CustomEvent) => {
      console.log("Calculator: Received config update event:", event.detail)
      setConfig(event.detail.config)
      setLastModified(event.detail.lastModified || "")
      toast({
        title: "Configuration Updated",
        description: "The configuration has been updated by an administrator.",
      })
    }

    window.addEventListener("configUpdated", handleConfigUpdate as EventListener)

    // Reduced polling frequency and smarter updates
    const intervalId = setInterval(
      async () => {
        try {
          console.log("Calculator: Polling for config updates...")
          const updatedData = await getCurrentConfig()
          
          // Only update if the lastModified timestamp is different
          if (updatedData.lastModified && updatedData.lastModified !== lastModified) {
            console.log("Calculator: Config timestamp changed, updating...")
            setConfig(updatedData.config)
            setLastModified(updatedData.lastModified)
            toast({
              title: "Configuration Updated",
              description: "The configuration has been updated.",
            })
          }
        } catch (error) {
          console.error("Calculator: Error checking for config updates:", error)
        }
      },
      60 * 1000, // Reduced to 60 seconds
    )

    return () => {
      window.removeEventListener("configUpdated", handleConfigUpdate as EventListener)
      clearInterval(intervalId)
    }
  }, [lastModified]) // Add lastModified as dependency

  // Get all available makes
  const makes = Object.keys(config.models)

  // Get models for selected make
  const getModels = (selectedMake: string) => {
    if (!selectedMake) return []
    return Object.keys(config.models[selectedMake] || {})
  }

  // Get base class for selected model
  const getBaseClass = (selectedMake: string, selectedModel: string) => {
    if (!selectedMake || !selectedModel) return ""
    return config.models[selectedMake]?.[selectedModel]?.baseClass || ""
  }

  // Calculate points from special indicators in base class
  const getBaseClassSpecialPoints = (baseClassValue: string) => {
    let points = 0
    if (baseClassValue.includes("*")) points += 7
    if (baseClassValue.includes("$")) points += 5
    return points
  }

  // Clean base class by removing special indicators
  const cleanBaseClass = (baseClassValue: string) => {
    return baseClassValue.replace(/[*$]/g, "")
  }

  // Handle make selection
  const handleMakeChange = (value: string) => {
    setMake(value)
    setModel("")
    setBaseClass("")
    setShowResults(false)
  }

  // Handle model selection
  const handleModelChange = (value: string) => {
    setModel(value)
    const newBaseClass = getBaseClass(make, value)
    setBaseClass(newBaseClass)
    setBaseClassPoints(getBaseClassSpecialPoints(newBaseClass))
    setShowResults(false)
  }

  // Handle modification selection
  const handleModChange = (category: string, item: string, checked: boolean) => {
    setSelectedMods((prev) => {
      const newMods = { ...prev }
      if (checked) {
        newMods[category] = [...(newMods[category] || []), item]
      } else {
        newMods[category] = (newMods[category] || []).filter((mod) => mod !== item)
      }
      return newMods
    })

    // Clear tire error when a tire is selected
    if (category === "tires" && checked) {
      setTiresError(false)
    }

    setShowResults(false)
  }

  // Calculate total points from selected modifications
  const calculateModPoints = () => {
    let points = 0
    Object.entries(selectedMods).forEach(([category, items]) => {
      items.forEach((item) => {
        points += config.scoreLookupTable[category][item] || 0
      })
    })
    return points
  }

  // Calculate final class based on base class and points
  const calculateFinalClass = (baseClassValue: string, totalPoints: number) => {
    // Clean base class (remove special indicators)
    const cleanedBaseClass = cleanBaseClass(baseClassValue)

    // Find the index of the base class in the classes array
    const baseClassIndex = config.classes.indexOf(cleanedBaseClass)
    if (baseClassIndex === -1) return "Unknown"

    // Calculate how many classes to move up
    let classesToMoveUp = 0
    if (totalPoints >= 14 && totalPoints < 28) classesToMoveUp = 1
    else if (totalPoints >= 28 && totalPoints < 42) classesToMoveUp = 2
    else if (totalPoints >= 42 && totalPoints < 56) classesToMoveUp = 3
    else if (totalPoints >= 56 && totalPoints < 70) classesToMoveUp = 4
    else if (totalPoints >= 70 && totalPoints < 84) classesToMoveUp = 5
    else if (totalPoints >= 84) classesToMoveUp = 6

    // Calculate new class index (capped at the highest class)
    const newClassIndex = Math.min(baseClassIndex + classesToMoveUp, config.classes.length - 1)

    return config.classes[newClassIndex]
  }

  // Calculate results
  const calculateResults = () => {
    // Check if tires have been selected
    if (selectedMods.tires.length === 0) {
      setTiresError(true)
      setActiveTab("tires")
      toast({
        variant: "destructive",
        title: "Tire selection required",
        description: "You must select a tire type to calculate your class.",
        action: <ToastAction altText="Go to tires">Go to tires</ToastAction>,
      })
      return
    }

    const basePoints = getBaseClassSpecialPoints(baseClass)
    const modPoints = calculateModPoints()
    const total = basePoints + modPoints

    setBaseClassPoints(basePoints)
    setModificationPoints(modPoints)
    setTotalPoints(total)
    setFinalClass(calculateFinalClass(baseClass, total))
    setShowResults(true)

    // Scroll to results after a short delay to allow rendering
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
  }

  // Reset all selections
  const resetForm = () => {
    setMake("")
    setModel("")
    setBaseClass("")
    setSelectedMods({
      engine: [],
      drivetrain: [],
      suspension: [],
      chassis: [],
      aero: [],
      tires: [],
      "weight-reduction": [],
      electronics: [],
    })
    setBaseClassPoints(0)
    setModificationPoints(0)
    setTotalPoints(0)
    setFinalClass("")
    setShowResults(false)
    setTiresError(false)
  }

  // Save current configuration
  const saveConfiguration = () => {
    const timestamp = new Date().toISOString()
    const config = {
      make,
      model,
      baseClass,
      mods: selectedMods,
      baseClassPoints,
      modificationPoints,
      totalPoints,
      finalClass,
      timestamp,
    }
    setSavedConfigs((prev) => [config, ...prev])

    // Save to localStorage
    try {
      const existingConfigs = JSON.parse(localStorage.getItem("savedConfigs") || "[]")
      localStorage.setItem("savedConfigs", JSON.stringify([config, ...existingConfigs]))

      // Show success message
      toast({
        title: "Configuration Saved",
        description: `Your ${make} ${model} configuration has been saved successfully.`,
      })

      // Reset form after saving
      resetForm()
    } catch (error) {
      console.error("Error saving to localStorage:", error)
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "There was an error saving your configuration. Please try again.",
      })
    }
  }

  // Load saved configurations from localStorage on component mount
  useEffect(() => {
    try {
      const savedConfigs = JSON.parse(localStorage.getItem("savedConfigs") || "[]")
      setSavedConfigs(savedConfigs)
    } catch (error) {
      console.error("Error loading from localStorage:", error)
    }
  }, [])

  // Load a saved configuration
  const loadConfiguration = (config: any) => {
    setMake(config.make)
    setModel(config.model)
    setBaseClass(config.baseClass)
    setSelectedMods(config.mods)
    setBaseClassPoints(config.baseClassPoints || 0)
    setModificationPoints(config.modificationPoints || 0)
    setTotalPoints(config.totalPoints)
    setFinalClass(config.finalClass)
    setShowResults(true)
    setTiresError(false)

    // Switch to calculator tab
    setActiveTabSection("calculator")
  }

  // Delete a saved configuration
  const deleteConfiguration = (indexToDelete: number) => {
    const configToDelete = savedConfigs[indexToDelete]

    // Remove from state
    const updatedConfigs = savedConfigs.filter((_, index) => index !== indexToDelete)
    setSavedConfigs(updatedConfigs)

    // Update localStorage
    try {
      localStorage.setItem("savedConfigs", JSON.stringify(updatedConfigs))

      toast({
        title: "Configuration Deleted",
        description: `${configToDelete.make} ${configToDelete.model} configuration has been deleted.`,
      })
    } catch (error) {
      console.error("Error updating localStorage:", error)
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "There was an error deleting the configuration. Please try again.",
      })
    }
  }

  // Get class color based on class name
  const getClassColor = (className: string) => {
    const colors: Record<string, string> = {
      TTS: "bg-gray-500",
      TTE: "bg-blue-500",
      TTD: "bg-green-500",
      TTC: "bg-yellow-500",
      TTB: "bg-orange-500",
      TTA: "bg-red-500",
      TTX: "bg-purple-500",
    }
    return colors[className] || "bg-gray-500"
  }

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Handle main tab section change
  const handleTabSectionChange = (value: string) => {
    setActiveTabSection(value)
  }

  // Get special indicators explanation
  const getSpecialIndicatorsExplanation = () => {
    const hasAsterisk = baseClass.includes("*")
    const hasDollar = baseClass.includes("$")

    if (hasAsterisk && hasDollar) {
      return "* adds +7 points, $ adds +5 points (total +12 points)"
    } else if (hasAsterisk) {
      return "* adds +7 points"
    } else if (hasDollar) {
      return "$ adds +5 points"
    }
    return null
  }

  // Format modifications for submission
  const formatModificationsForSubmission = (mods: Record<string, string[]>) => {
    let result = ""
    Object.entries(mods).forEach(([category, items]) => {
      if (items.length > 0) {
        result += `\n${category.toUpperCase()}:\n`
        items.forEach((item) => {
          result += `- ${item}\n`
        })
      }
    })
    return result
  }

  // Submit configuration to Google Form
  const submitConfiguration = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedConfigIndex === null) {
      toast({
        variant: "destructive",
        title: "No configuration selected",
        description: "Please select a configuration to submit.",
      })
      return
    }

    if (!firstName || !lastName || !driverEmail || !carNumber) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const config = savedConfigs[selectedConfigIndex]
      const timestamp = new Date().toISOString()

// Combine first
