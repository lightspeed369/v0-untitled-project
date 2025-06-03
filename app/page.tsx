import TrackClassCalculator from "@/components/track-class-calculator"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-center mb-2">
              LightSpeed Time Trial Classification Calculator
              <span className="text-[#fec802] ml-2">⚡</span>
            </h1>
            <p className="text-center text-[#fec802]">Determine your vehicle's classification based on modifications</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="text-[#fec802] hover:text-[#fec802]/80 text-sm">
              Admin
            </Link>
          </div>
        </div>
        <TrackClassCalculator />
      </div>
    </main>
  )
}
