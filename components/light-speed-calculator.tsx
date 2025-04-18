"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Constants
const SPEED_OF_LIGHT = 299792458 // meters per second

export default function LightSpeedCalculator() {
  const [distance, setDistance] = useState<number>(0)
  const [distanceUnit, setDistanceUnit] = useState<string>("meters")
  const [results, setResults] = useState<{
    meters: number
    lightSeconds: number
    timeToTravel: number
  } | null>(null)
  const [savedResults, setSavedResults] = useState<
    Array<{
      distance: number
      unit: string
      meters: number
      lightSeconds: number
      timeToTravel: number
    }>
  >([])

  // Convert distance to meters based on selected unit
  const convertToMeters = (value: number, unit: string): number => {
    switch (unit) {
      case "kilometers":
        return value * 1000
      case "miles":
        return value * 1609.34
      case "lightYears":
        return value * 9.461e15
      case "astronomicalUnits":
        return value * 1.496e11
      default:
        return value
    }
  }

  // Calculate time to travel at light speed
  const calculateLightSpeed = () => {
    if (!distance || distance <= 0) return

    const distanceInMeters = convertToMeters(distance, distanceUnit)
    const lightSeconds = distanceInMeters / SPEED_OF_LIGHT
    const timeToTravel = lightSeconds // time in seconds

    const result = {
      meters: distanceInMeters,
      lightSeconds,
      timeToTravel,
    }

    setResults(result)

    // Save to history
    setSavedResults((prev) => [
      {
        distance,
        unit: distanceUnit,
        ...result,
      },
      ...prev.slice(0, 9), // Keep only the 10 most recent results
    ])
  }

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 0.000001) {
      return `${(seconds * 1000000000).toFixed(2)} nanoseconds`
    } else if (seconds < 0.001) {
      return `${(seconds * 1000000).toFixed(2)} microseconds`
    } else if (seconds < 1) {
      return `${(seconds * 1000).toFixed(2)} milliseconds`
    } else if (seconds < 60) {
      return `${seconds.toFixed(2)} seconds`
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(2)} minutes`
    } else if (seconds < 86400) {
      return `${(seconds / 3600).toFixed(2)} hours`
    } else if (seconds < 31536000) {
      return `${(seconds / 86400).toFixed(2)} days`
    } else {
      return `${(seconds / 31536000).toFixed(2)} years`
    }
  }

  // Clear all saved results
  const clearHistory = () => {
    setSavedResults([])
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Calculate Light Travel Time</CardTitle>
          <CardDescription>
            Enter a distance to calculate how long it would take light to travel that distance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distance">Distance</Label>
                <Input
                  id="distance"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Enter distance"
                  value={distance || ""}
                  onChange={(e) => setDistance(Number.parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={distanceUnit} onValueChange={setDistanceUnit}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meters">Meters</SelectItem>
                    <SelectItem value="kilometers">Kilometers</SelectItem>
                    <SelectItem value="miles">Miles</SelectItem>
                    <SelectItem value="astronomicalUnits">Astronomical Units (AU)</SelectItem>
                    <SelectItem value="lightYears">Light Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={calculateLightSpeed}>Calculate</Button>

            {results && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="text-lg font-medium mb-2">Results:</h3>
                <p>
                  <strong>Distance in meters:</strong> {results.meters.toLocaleString()} m
                </p>
                <p>
                  <strong>Light seconds:</strong> {results.lightSeconds.toLocaleString()} seconds
                </p>
                <p>
                  <strong>Time to travel at light speed:</strong> {formatTime(results.timeToTravel)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {savedResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Calculation History</CardTitle>
            <CardDescription>Your recent calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Distance</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Light Seconds</TableHead>
                    <TableHead>Travel Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>{result.distance}</TableCell>
                      <TableCell>{result.unit}</TableCell>
                      <TableCell>{result.lightSeconds.toFixed(6)}</TableCell>
                      <TableCell>{formatTime(result.timeToTravel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" className="mt-4" onClick={clearHistory}>
              Clear History
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
