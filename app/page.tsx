'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAuth } from '@/context/AuthContext'

export default function HomePage() {
  const { user, loading, signOut, configError } = useAuth()

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (configError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-16">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Supabase not configured</CardTitle>
            <CardDescription>
              Create <code className="text-xs">.env.local</code> from{' '}
              <code className="text-xs">.env.example</code> and restart the dev server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorMessage message={configError} />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Phase 1 auth
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            TenexPerplexity
          </h1>
          <p className="text-lg text-muted-foreground">
            You&apos;re signed in. Chat, web search, and graph branching land in later phases.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Signed in</CardTitle>
            <CardDescription>
              Protected home route — middleware redirects unauthenticated users to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground break-all">
              {user?.email ?? 'No email on session'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await signOut()
                window.location.href = '/auth/signin'
              }}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
