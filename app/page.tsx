import TrackClassCalculator from "@/components/track-class-calculator"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* The Admin link used to be absolutely positioned at top-right. Out-of-flow
            elements reserve no space, so nothing reflows around them: once the title
            wrapped — which it does on any phone — its first line ran the full width and
            the link printed on top of the word "Trial". Keeping the link in normal flow
            on its own row means it can never collide, at any width. */}
        <div className="mb-2">
          <div className="flex justify-end">
            <Link href="/admin" className="text-[#fec802] hover:text-[#fec802]/80 text-sm">
              Admin
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 text-balance">
            LightSpeed Time Trial Classification Calculator
            <span className="text-[#fec802] ml-2">⚡</span>
          </h1>
        </div>
        <p className="text-center text-[#fec802] mb-8">
          Determine your vehicle's classification based on modifications
        </p>
        <TrackClassCalculator />
      </div>
    </main>
  )
}
