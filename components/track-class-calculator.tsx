"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Car, Info, Save, Send } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { trackConfig } from "@/lib/track-config"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useMobile } from "@/hooks/use-mobile"

export default function TrackClassCalculator() {
  const isMobile = useMobile()

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
    weight: [],
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
  const [comments, setComments] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false)

  // Get all available makes
  const makes = Object.keys(trackConfig.models)

  // Get models for selected make
  const getModels = (selectedMake: string) => {
    if (!selectedMake) return []
    return Object.keys(trackConfig.models[selectedMake] || {})
  }

  // Get base class for selected model
  const getBaseClass = (selectedMake: string, selectedModel: string) => {
    if (!selectedMake || !selectedModel) return ""
    return trackConfig.models[selectedMake]?.[selectedModel]?.baseClass || ""
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
        points += trackConfig.scoreLookupTable[category][item] || 0
      })
    })
    return points
  }

  // Calculate final class based on base class and points
  const calculateFinalClass = (baseClassValue: string, totalPoints: number) => {
    // Clean base class (remove special indicators)
    const cleanedBaseClass = cleanBaseClass(baseClassValue)

    // Find the index of the base class in the classes array
    const baseClassIndex = trackConfig.classes.indexOf(cleanedBaseClass)
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
    const newClassIndex = Math.min(baseClassIndex + classesToMoveUp, trackConfig.classes.length - 1)

    return trackConfig.classes[newClassIndex]
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
      weight: [],
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

      // Combine first and last name for submission
      const fullName = `${firstName} ${lastName}`

      // Format the data for Google Form submission using the exact field IDs from your form
      const formData = new FormData()

      // Map form fields to the correct entry IDs from your Google Form
      formData.append("entry.258378709", new Date().toISOString().split("T")[0]) // Current date for Effective Date
      formData.append("entry.163721629", fullName) // Driver Name (combined)
      formData.append("entry.292301949", `${config.make} ${config.model}`) // Vehicle Make/Model
      formData.append("entry.1339041663", carNumber) // Car Number
      formData.append("entry.422981728", driverEmail) // Email Address
      formData.append("entry.1491829505", team || "N/A") // Team
      formData.append("entry.2081807962", cleanBaseClass(config.baseClass)) // Base Class (without special indicators)
      formData.append("entry.1533485464", config.finalClass) // Final Class
      formData.append("entry.245375180", config.totalPoints.toString()) // Total Points
      formData.append("entry.555215744", formatModificationsForSubmission(config.mods)) // Modifications only
      formData.append("entry.1222291435", comments || "") // Comments in separate field

      // Submit to the Google Form
      const formId = "1FAIpQLSfOULSPEv-xkaSdyK_sMcBfM1O3kqFah8BgpfJQbatlPffKFA"
      const response = await fetch(`https://docs.google.com/forms/d/e/${formId}/formResponse`, {
        method: "POST",
        body: formData,
        mode: "no-cors", // Required for Google Forms
      })

      setSubmissionSuccess(true)
      toast({
        title: "Submission successful",
        description: "Your configuration has been submitted successfully to LightSpeed TimeTrial Database.",
      })

      // Reset form fields
      setFirstName("")
      setLastName("")
      setDriverEmail("")
      setCarNumber("")
      setTeam("")
      setComments("")
      setSelectedConfigIndex(null)
    } catch (error) {
      console.error("Error submitting form:", error)
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "There was an error submitting your configuration. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTabSection} onValueChange={handleTabSectionChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black border border-[#fec802]/30">
          <TabsTrigger value="calculator" className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black">
            Calculator
          </TabsTrigger>
          <TabsTrigger value="saved" className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black">
            Saved
          </TabsTrigger>
          <TabsTrigger value="submit" className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black">
            Submit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6 mt-4">
          <Card className="border-[#fec802]/30 bg-black">
            <CardHeader className="border-b border-[#fec802]/30">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-[#fec802]" />
                Vehicle Selection
              </CardTitle>
              <CardDescription>Select your vehicle make and model to determine the base class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Select value={make} onValueChange={handleMakeChange}>
                    <SelectTrigger id="make">
                      <SelectValue placeholder="Select make" />
                    </SelectTrigger>
                    <SelectContent>
                      {makes.map((makeName) => (
                        <SelectItem key={makeName} value={makeName}>
                          {makeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={handleModelChange} disabled={!make}>
                    <SelectTrigger id="model">
                      <SelectValue placeholder={make ? "Select model" : "Select make first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getModels(make).map((modelName) => (
                        <SelectItem key={modelName} value={modelName}>
                          {modelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {baseClass && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Base Class</AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center gap-2">
                      Your vehicle's base class is:
                      <Badge className={`${getClassColor(cleanBaseClass(baseClass))} text-white`}>
                        {cleanBaseClass(baseClass)}
                      </Badge>
                    </div>

                    {getSpecialIndicatorsExplanation() && (
                      <div className="mt-2 text-sm">
                        <strong>Special Indicators:</strong> {getSpecialIndicatorsExplanation()}
                      </div>
                    )}

                    {baseClassPoints > 0 && (
                      <div className="mt-1 text-sm">
                        Base class special indicators add <strong>+{baseClassPoints} points</strong> to your total.
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {baseClass && (
            <Card className="border-[#fec802]/30 bg-black">
              <CardHeader className="border-b border-[#fec802]/30">
                <CardTitle>Modifications</CardTitle>
                <CardDescription>
                  Select all modifications that apply to your vehicle
                  <span className="text-red-400 ml-1">(tire selection is required)</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <ScrollArea className="w-full">
                    <TabsList className="inline-flex w-auto bg-black border border-[#fec802]/30">
                      <TabsTrigger
                        value="engine"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Engine
                      </TabsTrigger>
                      <TabsTrigger
                        value="drivetrain"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Drivetrain
                      </TabsTrigger>
                      <TabsTrigger
                        value="suspension"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Suspension
                      </TabsTrigger>
                      <TabsTrigger
                        value="chassis"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Chassis
                      </TabsTrigger>
                      <TabsTrigger
                        value="aero"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Aero
                      </TabsTrigger>
                      <TabsTrigger
                        value="tires"
                        className={`data-[state=active]:bg-[#fec802] data-[state=active]:text-black ${tiresError ? "text-red-400 border-red-400" : ""}`}
                      >
                        Tires*
                      </TabsTrigger>
                      <TabsTrigger
                        value="weight"
                        className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                      >
                        Weight
                      </TabsTrigger>
                    </TabsList>
                  </ScrollArea>

                  {Object.entries(trackConfig.scoreLookupTable).map(([category, items]) => (
                    <TabsContent key={category} value={category} className="space-y-4 mt-4">
                      {category === "tires" && (
                        <Alert variant={tiresError ? "destructive" : "default"} className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Required Selection</AlertTitle>
                          <AlertDescription>
                            You must select at least one tire type. If you're using the original OEM tires, select that
                            option.
                          </AlertDescription>
                        </Alert>
                      )}

                      <ScrollArea className={`${isMobile ? "h-[250px]" : "h-[300px]"} pr-4`}>
                        {Object.entries(items).map(([item, points], index) => (
                          <div key={item} className="flex items-start space-x-2 py-2">
                            <Checkbox
                              id={`${category}-${index}`}
                              checked={selectedMods[category]?.includes(item)}
                              onCheckedChange={(checked) => handleModChange(category, item, checked === true)}
                              // For tires, make it radio-like behavior by unchecking others when one is selected
                              onClick={() => {
                                if (category === "tires" && !selectedMods[category]?.includes(item)) {
                                  setSelectedMods((prev) => ({
                                    ...prev,
                                    tires: [],
                                  }))
                                }
                              }}
                            />
                            <div className="grid gap-1.5 leading-none">
                              <Label
                                htmlFor={`${category}-${index}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {/* Extract the full description without the last points part */}
                                {item.substring(0, item.lastIndexOf("(")).trim()}
                                <Badge className="ml-2 bg-gray-700">{points > 0 ? `+${points}` : points} points</Badge>
                              </Label>
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-4 justify-between border-t border-[#fec802]/20 pt-6">
                <Button
                  onClick={calculateResults}
                  className="w-full sm:w-auto bg-[#fec802] hover:bg-[#fec802]/80 text-black"
                >
                  Calculate Class
                </Button>
                <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                  Reset
                </Button>
              </CardFooter>
            </Card>
          )}

          {showResults && (
            <Card className="border-[#fec802]/30 bg-black">
              <CardHeader className="border-b border-[#fec802]/30">
                <CardTitle>Results</CardTitle>
                <CardDescription>Your vehicle's classification based on modifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-black border border-[#fec802]/30 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Base Class</p>
                    <Badge className={`${getClassColor(cleanBaseClass(baseClass))} text-white text-lg py-1 px-3 mt-1`}>
                      {cleanBaseClass(baseClass)}
                    </Badge>
                    {baseClassPoints > 0 && (
                      <p className="text-xs text-gray-400 mt-1">+{baseClassPoints} points from indicators</p>
                    )}
                  </div>

                  <div className="p-4 bg-black border border-[#fec802]/30 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Modification Points</p>
                    <div className="flex flex-col items-center justify-center mt-1">
                      <p className="text-2xl font-bold">{totalPoints}</p>
                      {baseClassPoints > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          ({baseClassPoints} from base class + {modificationPoints} from mods)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-black border border-[#fec802]/30 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Final Class</p>
                    <Badge className={`${getClassColor(finalClass)} text-white text-lg py-1 px-3 mt-1`}>
                      {finalClass}
                    </Badge>
                  </div>
                </div>

                <Alert className="bg-black border-[#fec802]/30">
                  <Info className="h-4 w-4 text-[#fec802]" />
                  <AlertTitle>Classification Summary</AlertTitle>
                  <AlertDescription>
                    <p>
                      Your {make} {model} has been classified as <strong>{finalClass}</strong> based on your
                      modifications.
                    </p>
                    {cleanBaseClass(baseClass) !== finalClass && (
                      <p className="mt-1">
                        Your vehicle moved up from {cleanBaseClass(baseClass)} to {finalClass} due to {totalPoints}{" "}
                        total points
                        {baseClassPoints > 0 ? ` (including ${baseClassPoints} points from base class indicators)` : ""}
                        .
                      </p>
                    )}
                  </AlertDescription>
                </Alert>

                <Button onClick={saveConfiguration} className="w-full mt-4" variant="secondary">
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          <Card className="border-[#fec802]/30 bg-black">
            <CardHeader className="border-b border-[#fec802]/30">
              <CardTitle>Saved Configurations</CardTitle>
              <CardDescription>Your previously saved vehicle configurations</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {savedConfigs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No saved configurations yet.</p>
                  <p className="text-sm mt-2">Calculate and save a configuration to see it here.</p>
                </div>
              ) : (
                <ScrollArea className={`${isMobile ? "h-[350px]" : "h-[400px]"}`}>
                  <div className="space-y-4">
                    {savedConfigs.map((config, index) => (
                      <div key={index} className="p-4 bg-black border border-[#fec802]/30 rounded-lg">
                        <div className={`flex ${isMobile ? "flex-col" : "justify-between"} items-start`}>
                          <div>
                            <h3 className="font-medium">
                              {config.make} {config.model}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {new Date(config.timestamp).toLocaleDateString()} at{" "}
                              {new Date(config.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className={`flex gap-2 ${isMobile ? "mt-2" : ""}`}>
                            <Badge className={`${getClassColor(cleanBaseClass(config.baseClass))} text-white`}>
                              Base: {cleanBaseClass(config.baseClass)}
                            </Badge>
                            <Badge className={`${getClassColor(config.finalClass)} text-white`}>
                              Final: {config.finalClass}
                            </Badge>
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="text-sm">
                          <p>Total Points: {config.totalPoints}</p>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-[#fec802] text-sm"
                            onClick={() => loadConfiguration(config)}
                          >
                            Load Configuration
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submit" className="mt-4">
          <Card className="border-[#fec802]/30 bg-black">
            <CardHeader className="border-b border-[#fec802]/30">
              <CardTitle>Submit Configuration</CardTitle>
              <CardDescription>
                Submit your vehicle configuration for event registration or technical inspection
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {submissionSuccess ? (
                <div className="text-center py-8">
                  <div className="bg-green-900/20 text-green-400 p-4 rounded-lg mb-4">
                    <h3 className="text-lg font-medium">Submission Successful!</h3>
                    <p>Your configuration has been submitted successfully to LightSpeed TimeTrial Database.</p>
                    <p className="text-sm mt-2">Submission time: {new Date().toLocaleString()}</p>
                  </div>
                  <Button
                    onClick={() => setSubmissionSuccess(false)}
                    className="bg-[#fec802] hover:bg-[#fec802]/80 text-black"
                  >
                    Submit Another Configuration
                  </Button>
                </div>
              ) : savedConfigs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No saved configurations available to submit.</p>
                  <p className="text-sm mt-2">Please calculate and save a configuration before submitting.</p>
                </div>
              ) : (
                <form onSubmit={submitConfiguration} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">1. Select Configuration</h3>
                    <div className="space-y-4">
                      <RadioGroup
                        value={selectedConfigIndex !== null ? selectedConfigIndex.toString() : undefined}
                        onValueChange={(value) => setSelectedConfigIndex(Number.parseInt(value))}
                      >
                        {savedConfigs.map((config, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-2 p-4 border rounded-lg border-[#fec802]/30 bg-black"
                          >
                            <RadioGroupItem value={index.toString()} id={`config-${index}`} />
                            <div className="grid gap-1.5 leading-none w-full">
                              <Label htmlFor={`config-${index}`} className="text-base font-medium">
                                {config.make} {config.model}
                              </Label>
                              <div className={`flex ${isMobile ? "flex-col" : "justify-between"} items-start mt-2`}>
                                <div className="text-sm text-gray-400">
                                  {new Date(config.timestamp).toLocaleDateString()} at{" "}
                                  {new Date(config.timestamp).toLocaleTimeString()}
                                </div>
                                <div className={`flex gap-2 ${isMobile ? "mt-1" : ""}`}>
                                  <Badge className={`${getClassColor(cleanBaseClass(config.baseClass))} text-white`}>
                                    Base: {cleanBaseClass(config.baseClass)}
                                  </Badge>
                                  <Badge className={`${getClassColor(config.finalClass)} text-white`}>
                                    Final: {config.finalClass}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">2. Driver Information</h3>
                    <Alert className="mb-4 bg-[#fec802]/10 border-[#fec802]/20">
                      <Info className="h-4 w-4 text-[#fec802]" />
                      <AlertTitle>Important Note</AlertTitle>
                      <AlertDescription>
                        The latest submission will be used to determine your vehicle's classification.
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">First Name*</Label>
                        <Input
                          id="first-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Enter your first name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">Last Name*</Label>
                        <Input
                          id="last-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Enter your last name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-email">Email Address*</Label>
                        <Input
                          id="driver-email"
                          type="email"
                          value={driverEmail}
                          onChange={(e) => setDriverEmail(e.target.value)}
                          placeholder="Enter your email address"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="team">Team</Label>
                        <Input
                          id="team"
                          value={team}
                          onChange={(e) => setTeam(e.target.value)}
                          placeholder="Enter your team name (optional)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="car-number">Car Number*</Label>
                        <Input
                          id="car-number"
                          value={carNumber}
                          onChange={(e) => setCarNumber(e.target.value)}
                          placeholder="Enter your car number"
                          required
                        />
                      </div>
                      <div className="space-y-2 flex items-end">
                        <a
                          href="mailto:oguo@lightspeedclub.com"
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#fec802] text-black hover:bg-[#fec802]/80 h-10 px-4 py-2 w-full"
                        >
                          Email TimeTrial Director
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comments">Additional Comments</Label>
                    <Textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Any additional information about your vehicle or modifications"
                      className="min-h-[100px]"
                    />
                  </div>

                  <Alert className="bg-black border-[#fec802]/30">
                    <Info className="h-4 w-4 text-[#fec802]" />
                    <AlertTitle>Submission Information</AlertTitle>
                    <AlertDescription>
                      Your configuration details will be submitted for review. Make sure all information is accurate
                      before submitting.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="w-full bg-[#fec802] hover:bg-[#fec802]/80 text-black"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-4 w-4 text-black"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Configuration
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
