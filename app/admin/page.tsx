"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { Check, Edit, Lock, Save, X, History, Clock, AlertTriangle, RotateCcw } from "lucide-react"
import {
  getCurrentConfig,
  saveConfigToServer,
  saveConfigToStorage,
  createModString,
  parseBaseClass,
  formatBaseClass,
  extractNameFromMod,
  extractPointsFromMod,
  broadcastConfigChange,
} from "@/lib/admin-utils"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [config, setConfig] = useState<any>(null)
  const [originalConfig, setOriginalConfig] = useState<any>(null)
  const [changeLog, setChangeLog] = useState<any[]>([])
  const [lastModified, setLastModified] = useState<string>("")
  const [activeTab, setActiveTab] = useState("cars")
  const [selectedMake, setSelectedMake] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [newMake, setNewMake] = useState("")
  const [newModel, setNewModel] = useState("")
  const [newBaseClass, setNewBaseClass] = useState("TTS")
  const [hasAsterisk, setHasAsterisk] = useState(false)
  const [hasDollar, setHasDollar] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [modificationName, setModificationName] = useState("")
  const [modificationPoints, setModificationPoints] = useState(0)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editingMod, setEditingMod] = useState<string | null>(null)
  const [editModName, setEditModName] = useState("")
  const [editModPoints, setEditModPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [adminId] = useState("lsadmin")
  const [isPersistenceEnabled, setIsPersistenceEnabled] = useState(true)
  const [versions, setVersions] = useState<any[]>([])
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)

  // Restore an existing admin session on mount so a page reload doesn't force a
  // re-login, and warn early if the server has no admin password configured.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" })
        const data = await response.json()
        if (data.authenticated) setIsAuthenticated(true)
        if (!data.authConfigured) {
          toast({
            variant: "destructive",
            title: "Admin access not configured",
            description: "ADMIN_PASSWORD is not set on the server, so configuration cannot be saved.",
          })
        }
      } catch (error) {
        console.error("Error checking session:", error)
      }
    }
    restoreSession()
  }, [])

  // Load configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        const currentData = await getCurrentConfig()
        setConfig(currentData.config)
        setOriginalConfig(JSON.parse(JSON.stringify(currentData.config))) // Deep copy for comparison
        setChangeLog(currentData.changeLog || [])
        setLastModified(currentData.lastModified || "")
        setIsPersistenceEnabled(currentData.isPersistenceEnabled) // Set the new state
      } catch (error) {
        console.error("Error loading configuration:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load configuration. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  // Add this function to the admin page component
  const checkServerStatus = async () => {
    try {
      const response = await fetch("/api/config/status")
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status} ${response.statusText}`)
      }
      const status = await response.json()

      toast({
        title: "Server Status",
        description: (
          <div className="space-y-2 mt-2">
            <p>Data directory: {status.dataDir}</p>
            <p>Directory exists: {status.dataDirectoryExists ? "✅" : "❌"}</p>
            <p>Directory writable: {status.dataDirectoryWritable ? "✅" : "❌"}</p>
            <p>Config file exists: {status.configFileExists ? "✅" : "❌"}</p>
            <p>Changes persist: {status.isPersistenceEnabled ? "✅" : "❌"}</p>
            <p>Server time: {new Date(status.serverTime).toLocaleString()}</p>
          </div>
        ),
        duration: 10000,
      })
    } catch (error) {
      console.error("Error checking server status:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to check server status: ${error}`,
      })
    }
  }

  // Handle authentication.
  // The password is verified server-side; it is never compared in the browser and
  // never shipped in the client bundle. On success the server sets an httpOnly
  // session cookie, which is what actually authorises writes to /api/config.
  const handleAuthenticate = async () => {
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setPassword("")
        toast({
          title: "Authentication successful",
          description: "You are now logged in as an administrator.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Authentication failed",
          description: data.message || "Invalid password. Please try again.",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: `Could not reach the server: ${error}`,
      })
    }
  }

  // Version history is admin-only, so it can only be fetched once authenticated.
  const loadVersions = async () => {
    try {
      const response = await fetch("/api/config/versions", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setVersions(data.versions || [])
    } catch (error) {
      console.error("Error loading versions:", error)
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadVersions()
  }, [isAuthenticated])

  // Roll the live configuration back to an earlier snapshot. The server treats this
  // as an ordinary write, so the current state is snapshotted first and this restore
  // is itself undoable.
  const handleRestoreVersion = async (versionId: string) => {
    setIsRestoring(versionId)
    try {
      const response = await fetch(`/api/config/versions/${versionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const refreshed = await getCurrentConfig()
        setConfig(refreshed.config)
        setOriginalConfig(JSON.parse(JSON.stringify(refreshed.config)))
        setChangeLog(refreshed.changeLog || [])
        setLastModified(refreshed.lastModified || "")
        saveConfigToStorage(refreshed.config, refreshed.lastModified)
        broadcastConfigChange(refreshed.config, refreshed.lastModified)
        await loadVersions()
        toast({
          title: "Configuration restored",
          description: "The earlier version is now live. This restore can itself be undone.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Restore failed",
          description: data.message || "Could not restore that version.",
        })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Restore failed", description: String(error) })
    } finally {
      setIsRestoring(null)
      setConfirmRestoreId(null)
    }
  }

  // Handle logout — clears the server session cookie too, not just local state.
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/session", { method: "DELETE" })
    } catch (error) {
      console.error("Error clearing session:", error)
    }
    setIsAuthenticated(false)
    setPassword("")
  }

  // Handle adding a new make
  const handleAddMake = () => {
    if (!newMake) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Make name cannot be empty.",
      })
      return
    }

    if (config.models[newMake]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "This make already exists.",
      })
      return
    }

    const updatedConfig = { ...config }
    updatedConfig.models[newMake] = {}
    setConfig(updatedConfig)
    setSelectedMake(newMake)
    setNewMake("")

    toast({
      title: "Make added",
      description: `${newMake} has been added successfully.`,
    })
  }

  // Handle adding a new model
  const handleAddModel = () => {
    if (!selectedMake) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a make first.",
      })
      return
    }

    if (!newModel) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Model name cannot be empty.",
      })
      return
    }

    if (config.models[selectedMake][newModel]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "This model already exists for the selected make.",
      })
      return
    }

    const formattedBaseClass = formatBaseClass(newBaseClass, hasAsterisk, hasDollar)

    const updatedConfig = { ...config }
    updatedConfig.models[selectedMake][newModel] = { baseClass: formattedBaseClass }
    setConfig(updatedConfig)
    setSelectedModel(newModel)
    setNewModel("")

    toast({
      title: "Model added",
      description: `${newModel} has been added to ${selectedMake} with base class ${formattedBaseClass}.`,
    })
  }

  // Handle editing a model's base class
  const handleEditModel = () => {
    if (!selectedMake || !selectedModel) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a make and model first.",
      })
      return
    }

    const formattedBaseClass = formatBaseClass(newBaseClass, hasAsterisk, hasDollar)

    const updatedConfig = { ...config }
    updatedConfig.models[selectedMake][selectedModel] = { baseClass: formattedBaseClass }
    setConfig(updatedConfig)

    toast({
      title: "Model updated",
      description: `${selectedModel} has been updated with base class ${formattedBaseClass}.`,
    })
  }

  // Handle deleting a model
  const handleDeleteModel = () => {
    if (!selectedMake || !selectedModel) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a make and model first.",
      })
      return
    }

    const updatedConfig = { ...config }
    delete updatedConfig.models[selectedMake][selectedModel]
    setConfig(updatedConfig)
    setSelectedModel("")

    toast({
      title: "Model deleted",
      description: `${selectedModel} has been deleted from ${selectedMake}.`,
    })
  }

  // Handle deleting a make
  const handleDeleteMake = () => {
    if (!selectedMake) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a make first.",
      })
      return
    }

    const updatedConfig = { ...config }
    delete updatedConfig.models[selectedMake]
    setConfig(updatedConfig)
    setSelectedMake("")
    setSelectedModel("")

    toast({
      title: "Make deleted",
      description: `${selectedMake} has been deleted.`,
    })
  }

  // Handle adding a new category
  const handleAddCategory = () => {
    if (!newCategory) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Category name cannot be empty.",
      })
      return
    }

    if (config[newCategory]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "This category already exists.",
      })
      return
    }

    const updatedConfig = { ...config }
    updatedConfig[newCategory] = []
    updatedConfig.scoreLookupTable[newCategory] = {}
    setConfig(updatedConfig)
    setSelectedCategory(newCategory)
    setNewCategory("")

    toast({
      title: "Category added",
      description: `${newCategory} has been added successfully.`,
    })
  }

  // Handle adding a new modification
  const handleAddModification = () => {
    if (!selectedCategory) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a category first.",
      })
      return
    }

    if (!modificationName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Modification name cannot be empty.",
      })
      return
    }

    const modString = createModString(modificationName, modificationPoints)

    const updatedConfig = { ...config }
    updatedConfig[selectedCategory].push(modString)
    updatedConfig.scoreLookupTable[selectedCategory][modString] = modificationPoints
    setConfig(updatedConfig)
    setModificationName("")
    setModificationPoints(0)

    toast({
      title: "Modification added",
      description: `${modString} has been added to ${selectedCategory}.`,
    })
  }

  // Start editing a modification
  const handleStartEditMod = (mod: string) => {
    setEditingMod(mod)
    setEditModName(extractNameFromMod(mod))
    setEditModPoints(extractPointsFromMod(mod))
  }

  // Cancel editing a modification
  const handleCancelEditMod = () => {
    setEditingMod(null)
    setEditModName("")
    setEditModPoints(0)
  }

  // Save edited modification
  const handleSaveEditMod = () => {
    if (!editingMod || !selectedCategory) return

    const newModString = createModString(editModName, editModPoints)

    const updatedConfig = { ...config }
    // Remove the old modification
    updatedConfig[selectedCategory] = updatedConfig[selectedCategory].map((mod: string) =>
      mod === editingMod ? newModString : mod,
    )

    // Update the score lookup table
    delete updatedConfig.scoreLookupTable[selectedCategory][editingMod]
    updatedConfig.scoreLookupTable[selectedCategory][newModString] = editModPoints

    setConfig(updatedConfig)
    setEditingMod(null)
    setEditModName("")
    setEditModPoints(0)

    toast({
      title: "Modification updated",
      description: `Modification has been updated successfully.`,
    })
  }

  // Handle deleting a modification
  const handleDeleteModification = (category: string, modification: string) => {
    const updatedConfig = { ...config }
    updatedConfig[category] = updatedConfig[category].filter((mod: string) => mod !== modification)
    delete updatedConfig.scoreLookupTable[category][modification]
    setConfig(updatedConfig)

    toast({
      title: "Modification deleted",
      description: `${modification} has been deleted from ${category}.`,
    })
  }

  // Handle deleting a category
  const handleDeleteCategory = () => {
    if (!selectedCategory) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a category first.",
      })
      return
    }

    const updatedConfig = { ...config }
    delete updatedConfig[selectedCategory]
    delete updatedConfig.scoreLookupTable[selectedCategory]
    setConfig(updatedConfig)
    setSelectedCategory("")

    toast({
      title: "Category deleted",
      description: `${selectedCategory} has been deleted.`,
    })
  }

  // Handle saving the configuration
  const handleSaveConfig = async () => {
    setSaveSuccess(false)

    // First, save to the server with admin info and original config for comparison
    const serverResult = await saveConfigToServer(
      config,
      adminId,
      "Configuration updated via admin panel",
      originalConfig,
    )

    // Also save to localStorage as a backup
    const localSuccess = saveConfigToStorage(config, serverResult.data?.timestamp)

    if (serverResult.success) {
      // Update local state with new change log
      if (serverResult.data?.changeLog) {
        setChangeLog(serverResult.data.changeLog)
      }
      if (serverResult.data?.timestamp) {
        setLastModified(serverResult.data.timestamp)
      }

      // Update original config to current config for next comparison
      setOriginalConfig(JSON.parse(JSON.stringify(config))) // Deep copy

      // Broadcast the configuration change
      broadcastConfigChange(config, serverResult.data?.timestamp)

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      toast({
        title: "Configuration saved",
        description: "Your changes have been saved successfully and will be reflected for all users.",
      })
    } else {
      toast({
        variant: "destructive",
        title: "Server save failed",
        description: `Failed to save to server: ${serverResult.error || "Unknown error"}. If persistence is disabled, check that a writable volume is mounted at DATA_DIR.`,
        duration: 9000,
      })
    }
  }

  // Handle model selection
  const handleModelSelect = (model: string) => {
    setSelectedModel(model)
    if (config.models[selectedMake][model]) {
      const {
        class: baseClass,
        hasAsterisk: hasAst,
        hasDollar: hasDol,
      } = parseBaseClass(config.models[selectedMake][model].baseClass)
      setNewBaseClass(baseClass)
      setHasAsterisk(hasAst)
      setHasDollar(hasDol)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#fec802] mx-auto"></div>
          <p className="mt-4">Loading configuration...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Configuration</AlertTitle>
          <AlertDescription>
            Failed to load the configuration data. Please refresh the page or try again later.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="border-[#fec802]/30 bg-black mb-8">
        <CardHeader className="border-b border-[#fec802]/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-3xl">LightSpeed Admin Panel</CardTitle>
            {isAuthenticated && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => (window.location.href = "/")}>
                  Back to Home
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            )}
          </div>
          <CardDescription>Manage car makes, models, and modification categories</CardDescription>
          {lastModified && (
            <div className="text-sm text-gray-400 mt-2">Last modified: {new Date(lastModified).toLocaleString()}</div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {!isPersistenceEnabled && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Persistence is Disabled</AlertTitle>
              <AlertDescription>
                The server's data directory is not writable, so any changes you make will be lost when the server
                restarts. Check that a persistent volume is mounted and that DATA_DIR points at it.
              </AlertDescription>
            </Alert>
          )}
          {!isAuthenticated ? (
            <div className="space-y-4">
              <Alert className="bg-black border-[#fec802]/30">
                <Lock className="h-4 w-4 text-[#fec802]" />
                <AlertTitle>Authentication Required</AlertTitle>
                <AlertDescription>Please enter the administrator password to access the admin panel.</AlertDescription>
              </Alert>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-id">Admin ID</Label>
                  {/* Fixed: there is one admin identity and the server stamps it on
                      every change, so this is shown for information only. */}
                  <Input id="admin-id" value={adminId} readOnly disabled />
                </div>
                <div className="flex gap-4">
                  <Input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button onClick={handleAuthenticate}>Login</Button>
                  <Button variant="outline" onClick={() => (window.location.href = "/")}>
                    Back to Home
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-black border border-[#fec802]/30">
                <TabsTrigger value="cars" className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black">
                  Car Makes & Models
                </TabsTrigger>
                <TabsTrigger value="mods" className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black">
                  Modification Categories
                </TabsTrigger>
                <TabsTrigger
                  value="changelog"
                  className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                >
                  <History className="h-4 w-4 mr-2" />
                  Change Log
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  className="data-[state=active]:bg-[#fec802] data-[state=active]:text-black"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Versions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cars" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Add/Edit Make */}
                  <Card className="border-[#fec802]/30 bg-black">
                    <CardHeader className="border-b border-[#fec802]/30">
                      <CardTitle>Add New Make</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-make">Make Name</Label>
                        <div className="flex gap-2">
                          <Input
                            id="new-make"
                            placeholder="e.g., Honda"
                            value={newMake}
                            onChange={(e) => setNewMake(e.target.value)}
                          />
                          <Button onClick={handleAddMake}>Add</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Select Make */}
                  <Card className="border-[#fec802]/30 bg-black">
                    <CardHeader className="border-b border-[#fec802]/30">
                      <CardTitle>Select Make</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="select-make">Make</Label>
                        <div className="flex gap-2">
                          <Select value={selectedMake} onValueChange={setSelectedMake}>
                            <SelectTrigger id="select-make">
                              <SelectValue placeholder="Select make" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(config.models).map((make) => (
                                <SelectItem key={make} value={make}>
                                  {make}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedMake && (
                            <Button variant="destructive" onClick={handleDeleteMake}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Model */}
                  {selectedMake && (
                    <Card className="border-[#fec802]/30 bg-black">
                      <CardHeader className="border-b border-[#fec802]/30">
                        <CardTitle>Add New Model to {selectedMake}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-model">Model Name</Label>
                          <Input
                            id="new-model"
                            placeholder="e.g., Civic"
                            value={newModel}
                            onChange={(e) => setNewModel(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="base-class">Base Class</Label>
                          <Select value={newBaseClass} onValueChange={setNewBaseClass}>
                            <SelectTrigger id="base-class">
                              <SelectValue placeholder="Select base class" />
                            </SelectTrigger>
                            <SelectContent>
                              {config.classes.map((cls: string) => (
                                <SelectItem key={cls} value={cls}>
                                  {cls}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="asterisk"
                            checked={hasAsterisk}
                            onCheckedChange={(checked) => setHasAsterisk(checked === true)}
                          />
                          <Label htmlFor="asterisk">Add * (+7 points)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="dollar"
                            checked={hasDollar}
                            onCheckedChange={(checked) => setHasDollar(checked === true)}
                          />
                          <Label htmlFor="dollar">Add $ (+5 points)</Label>
                        </div>
                        <Button onClick={handleAddModel}>Add Model</Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Select and Edit Model */}
                  {selectedMake && (
                    <Card className="border-[#fec802]/30 bg-black">
                      <CardHeader className="border-b border-[#fec802]/30">
                        <CardTitle>Select and Edit Model</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="select-model">Model</Label>
                          <Select value={selectedModel} onValueChange={handleModelSelect}>
                            <SelectTrigger id="select-model">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(config.models[selectedMake] || {}).map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedModel && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="edit-base-class">Base Class</Label>
                              <Select value={newBaseClass} onValueChange={setNewBaseClass}>
                                <SelectTrigger id="edit-base-class">
                                  <SelectValue placeholder="Select base class" />
                                </SelectTrigger>
                                <SelectContent>
                                  {config.classes.map((cls: string) => (
                                    <SelectItem key={cls} value={cls}>
                                      {cls}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-asterisk"
                                checked={hasAsterisk}
                                onCheckedChange={(checked) => setHasAsterisk(checked === true)}
                              />
                              <Label htmlFor="edit-asterisk">Add * (+7 points)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-dollar"
                                checked={hasDollar}
                                onCheckedChange={(checked) => setHasDollar(checked === true)}
                              />
                              <Label htmlFor="edit-dollar">Add $ (+5 points)</Label>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleEditModel}>Update</Button>
                              <Button variant="destructive" onClick={handleDeleteModel}>
                                Delete
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mods" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Add Category */}
                  <Card className="border-[#fec802]/30 bg-black">
                    <CardHeader className="border-b border-[#fec802]/30">
                      <CardTitle>Add New Category</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-category">Category Name</Label>
                        <div className="flex gap-2">
                          <Input
                            id="new-category"
                            placeholder="e.g., brakes"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                          />
                          <Button onClick={handleAddCategory}>Add</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Select Category */}
                  <Card className="border-[#fec802]/30 bg-black">
                    <CardHeader className="border-b border-[#fec802]/30">
                      <CardTitle>Select Category</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="select-category">Category</Label>
                        <div className="flex gap-2">
                          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger id="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(config.scoreLookupTable).map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedCategory && (
                            <Button variant="destructive" onClick={handleDeleteCategory}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Modification */}
                  {selectedCategory && (
                    <Card className="border-[#fec802]/30 bg-black">
                      <CardHeader className="border-b border-[#fec802]/30">
                        <CardTitle>Add Modification to {selectedCategory}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="mod-name">Modification Name</Label>
                          <Input
                            id="mod-name"
                            placeholder="e.g., Performance Brakes"
                            value={modificationName}
                            onChange={(e) => setModificationName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mod-points">Points</Label>
                          <Input
                            id="mod-points"
                            type="number"
                            placeholder="e.g., 2"
                            value={modificationPoints}
                            onChange={(e) => setModificationPoints(Number(e.target.value))}
                          />
                        </div>
                        <Button onClick={handleAddModification}>Add Modification</Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* View Modifications */}
                  {selectedCategory && (
                    <Card className="border-[#fec802]/30 bg-black">
                      <CardHeader className="border-b border-[#fec802]/30">
                        <CardTitle>Modifications in {selectedCategory}</CardTitle>
                        <CardDescription>Click on a modification to edit it</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ScrollArea className="h-[300px] pr-4">
                          {config[selectedCategory] && config[selectedCategory].length > 0 ? (
                            <div className="space-y-4">
                              {config[selectedCategory].map((mod: string, index: number) => (
                                <div key={index}>
                                  {editingMod === mod ? (
                                    <div className="p-4 border border-[#fec802] rounded-lg">
                                      <div className="space-y-3">
                                        <div className="space-y-1">
                                          <Label htmlFor={`edit-mod-name-${index}`}>Modification Name</Label>
                                          <Input
                                            id={`edit-mod-name-${index}`}
                                            value={editModName}
                                            onChange={(e) => setEditModName(e.target.value)}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label htmlFor={`edit-mod-points-${index}`}>Points</Label>
                                          <Input
                                            id={`edit-mod-points-${index}`}
                                            type="number"
                                            value={editModPoints}
                                            onChange={(e) => setEditModPoints(Number(e.target.value))}
                                          />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <Button size="sm" onClick={handleCancelEditMod}>
                                            Cancel
                                          </Button>
                                          <Button size="sm" onClick={handleSaveEditMod}>
                                            Save
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-between items-center p-3 border border-[#fec802]/20 rounded-lg hover:border-[#fec802]/50 transition-colors">
                                      <span>{mod}</span>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleStartEditMod(mod)}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteModification(selectedCategory, mod)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center text-gray-400">No modifications in this category</p>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="changelog" className="space-y-6 mt-4">
                <Card className="border-[#fec802]/30 bg-black">
                  <CardHeader className="border-b border-[#fec802]/30">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-[#fec802]" />
                      Admin Change Log
                    </CardTitle>
                    <CardDescription>
                      Detailed track of all administrative changes made to the configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {changeLog.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>No changes recorded yet.</p>
                        <p className="text-sm mt-2">Changes will appear here after admin modifications are saved.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                          {changeLog.map((entry, index) => (
                            <div key={index} className="p-4 bg-black border border-[#fec802]/30 rounded-lg">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-[#fec802]" />
                                  <span className="font-medium text-[#fec802]">{entry.action}</span>
                                </div>
                                <span className="text-sm text-gray-400">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>

                              {entry.adminId && (
                                <p className="text-sm text-gray-400 mb-2">
                                  <strong>Admin:</strong> {entry.adminId}
                                </p>
                              )}

                              <div className="text-sm text-gray-300">
                                <strong>Changes Made:</strong>
                                <div className="mt-2 pl-4 border-l-2 border-[#fec802]/30">
                                  {entry.details ? (
                                    entry.details.split("; ").map((change, changeIndex) => (
                                      <div key={changeIndex} className="py-1">
                                        • {change}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="py-1">• No specific changes recorded.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="versions" className="space-y-6 mt-4">
                <Card className="border-[#fec802]/30 bg-black">
                  <CardHeader className="border-b border-[#fec802]/30">
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-[#fec802]" />
                      Previous Versions
                    </CardTitle>
                    <CardDescription>
                      A copy of the configuration is kept every time it is saved. Restoring one puts it
                      back live — and because a restore is saved like any other change, you can undo it too.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {versions.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>No previous versions yet.</p>
                        <p className="text-sm mt-2">
                          The first one is created the next time you save a change.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                          {versions.map((version) => (
                            <div
                              key={version.id}
                              className="p-4 bg-black border border-[#fec802]/30 rounded-lg"
                            >
                              <div className="flex justify-between items-start mb-3 gap-4">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-[#fec802]" />
                                  <span className="font-medium text-[#fec802]">
                                    {version.savedAt ? new Date(version.savedAt).toLocaleString() : version.id}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-400 whitespace-nowrap">
                                  {version.makeCount} makes · {version.modelCount} models
                                </span>
                              </div>

                              {version.adminId && (
                                <p className="text-sm text-gray-400 mb-2">
                                  <strong>Replaced by:</strong> {version.adminId}
                                </p>
                              )}

                              {version.note && (
                                <div className="text-sm text-gray-300 mb-3">
                                  <strong>Superseded by:</strong>
                                  <div className="mt-2 pl-4 border-l-2 border-[#fec802]/30 text-gray-400">
                                    {version.note}
                                  </div>
                                </div>
                              )}

                              {confirmRestoreId === version.id ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-gray-300">
                                    Replace the live configuration with this version?
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRestoreVersion(version.id)}
                                    disabled={isRestoring === version.id}
                                    className="bg-[#fec802] text-black hover:bg-[#fec802]/80"
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    {isRestoring === version.id ? "Restoring…" : "Yes, restore"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmRestoreId(null)}
                                    disabled={isRestoring === version.id}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmRestoreId(version.id)}
                                  className="border-[#fec802]/30"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Restore this version
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {isAuthenticated && (
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={checkServerStatus}>
            Check Server Status
          </Button>
          <Button
            onClick={handleSaveConfig}
            className="bg-[#fec802] hover:bg-[#fec802]/80 text-black"
            disabled={saveSuccess}
          >
            {saveSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
