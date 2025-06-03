import TrackClassCalculator from "@/components/track-class-calculator"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="relative mb-2">
          <h1 className="text-4xl font-bold text-center mb-2">
            LightSpeed Time Trial Classification Calculator
            <span className="text-[#fec802] ml-2">⚡</span>
          </h1>
          <div className="absolute top-0 right-0">
            <Link href="/admin" className="text-[#fec802] hover:text-[#fec802]/80 text-sm">
              Admin
            </Link>
          </div>
        </div>
        <p className="text-center text-[#fec802] mb-8">
          Determine your vehicle's classification based on modifications
        </p>
        <TrackClassCalculator />
      </div>
    </main>
  )
}
