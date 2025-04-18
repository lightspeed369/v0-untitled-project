import TrackClassCalculator from "@/components/track-class-calculator"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-2">Track Class Calculator</h1>
        <p className="text-center text-gray-300 mb-8">
          Determine your vehicle's track classification based on modifications
        </p>
        <TrackClassCalculator />
      </div>
    </main>
  )
}
