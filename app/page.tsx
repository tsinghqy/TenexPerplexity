import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Phase 0 scaffold
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            TenexPerplexity
          </h1>
          <p className="text-lg text-muted-foreground">
            Streaming answer engine with live web search, citations, and
            forkable research branches. Scaffold is up — auth, chat, search, and
            graph land in later phases.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checkpoint</CardTitle>
            <CardDescription>
              Verify this page loads with Tailwind + shadcn UI before merging P0.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button">Primary</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
            <Button type="button" variant="outline">
              Outline
            </Button>
          </CardContent>
        </Card>

        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>Next.js 15 + React 19</li>
          <li>Tailwind CSS 4 + DaisyUI theme</li>
          <li>shadcn/ui primitives</li>
          <li>Cursor rules + AGENTS.md</li>
        </ul>
      </div>
    </main>
  )
}
