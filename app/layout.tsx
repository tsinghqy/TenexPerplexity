import type { Metadata, Viewport } from "next"
import "./globals.css"

const getSiteUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  return "http://localhost:3000"
}

const siteUrl = getSiteUrl()

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#667eea",
  colorScheme: "dark",
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TenexPerplexity — Search with branching research",
    template: "%s | TenexPerplexity",
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
  authors: [{ name: "TenexPerplexity" }],
  creator: "TenexPerplexity",
  publisher: "TenexPerplexity",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "TenexPerplexity",
    title: "TenexPerplexity — Search with branching research",
    description:
      "Streaming answers with live web search, citations, and forkable research branches.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TenexPerplexity",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TenexPerplexity — Search with branching research",
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
    <html lang="en" data-theme="graphchat-dark">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
