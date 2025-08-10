import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Analytics } from '@/components/analytics'
import { Toaster } from 'sonner'
import { Suspense } from 'react'
import { cn } from "@/lib/utils"
import { fontSans } from "@/lib/fonts"
import { ChatLayoutWithHistory } from "@/components/chat-layout-with-history"
import { Eruda } from "@/components/eruda"

const inter = Inter({ subsets: ["latin"] })
const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-mono-price',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "SignalBox LLM - AI Agent Starter",
  description: "General-purpose LLM agent with streaming UI, memory, and currency tools. Deploy on Railway.",
  keywords: ["LLM", "AI agent", "Railway", "monorepo", "NestJS", "Next.js"],
  authors: [{ name: "SignalBox LLM" }],
  creator: "SignalBox LLM",
  
  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://example.com",
    siteName: "SignalBox LLM",
    title: "SignalBox LLM - AI Agent Starter",
    description: "General-purpose LLM agent with streaming UI, memory, and currency tools.",
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "SignalBox LLM - AI Agent Starter",
    description: "General-purpose LLM agent with streaming UI, memory, and currency tools.",
  },
  
  // PWA Configuration
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SignalBox LLM",
  },
  

  
  // Enhanced format detection for mobile
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "SignalBox LLM",
    "mobile-web-app-capable": "yes",
    "theme-color": "#ffffff",
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  category: "Software",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SignalBox LLM" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
        
        {/* Template: remove travel-specific structured data */}
      </head>
      <body
        className={cn(
          'h-dvh bg-background font-sans antialiased',
          fontSans.variable,
          jetbrainsMono.variable,
        )}
      >
        <Suspense>
          <Analytics />
        </Suspense>
        <Eruda />
        <Providers>
          <ChatLayoutWithHistory>
            {children}
          </ChatLayoutWithHistory>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}