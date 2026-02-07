import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "LightSpeed Time Trial Classification Calculator",
  description: "Calculate your vehicle's classification based on modifications",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="bg-[#fec802] text-black text-center py-1 text-sm font-semibold tracking-wide">
            WORK IN PROGRESS — NOT YET PUBLISHED
          </div>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
