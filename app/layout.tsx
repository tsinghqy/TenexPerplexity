import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"

// Auth + session cookies require a request; skip static prerender without env.
export const dynamic = "force-dynamic"

function normalizeSiteUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null
  }

  const trimmed = raw.trim().replace(/\/$/, "")
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return null
  }
}

const getSiteUrl = (): string => {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeSiteUrl(process.env.VERCEL_URL) ||
    "http://localhost:3000"
  )
}

const siteUrl = getSiteUrl()

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1C1B28",
  colorScheme: "dark",
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tenexity — Search with branching research",
    template: "%s | Tenexity",
  },
  description:
    "A streaming answer engine with live web search and citations. Fork follow-ups into isolated research branches with path-scoped RAG.",
  keywords: [
    "AI search",
    "web search",
    "citations",
    "knowledge graph",
    "research branching",
    "RAG",
  ],
  authors: [{ name: "Tenexity" }],
  creator: "Tenexity",
  publisher: "Tenexity",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Tenexity",
    title: "Tenexity — Search with branching research",
    description:
      "Streaming answers with live web search, citations, and forkable research branches.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tenexity",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tenexity — Search with branching research",
    description:
      "Streaming answers with live web search, citations, and forkable research branches.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: siteUrl,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme="tenexity">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
