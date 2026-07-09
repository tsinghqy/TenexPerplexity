'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth/client'
import { useAuthForm } from '@/lib/hooks/useAuthForm'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { ErrorMessage } from '@/components/ui/error-message'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AuthFormLayout } from '@/components/auth/AuthFormLayout'
import { Search } from 'lucide-react'

function SignInForm() {
  const router = useRouter()
  const { loading, setLoading, error, setError, authLoading, user, onSuccess } = useAuthForm()
  const { configError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await signIn(email, password)

      if (error) {
        setError(error.message || 'An error occurred during sign in')
        setLoading(false)
        return
      }

      if (!data?.user) {
        setError('Sign in failed. Please try again.')
        setLoading(false)
        return
      }

      if (data.user.email && !data.session) {
        setError('Please check your email to verify your account before signing in.')
        setLoading(false)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
      onSuccess()
    } catch (err) {
      console.error('Sign in error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      )
      setLoading(false)
    }
  }

  if (authLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (user) {
    return null
  }

  return (
    <AuthFormLayout
      title="Welcome to TenexPerplexity"
      description="Sign in to your account"
      icon={<Search className="h-8 w-8 text-primary" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorMessage message={configError || error} />

        <FormField
          label="Email"
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading || Boolean(configError)}
        />

        <FormField
          label="Password"
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading || Boolean(configError)}
        />

        <Button type="submit" className="w-full" disabled={loading || Boolean(configError)}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Button
          variant="link"
          className="p-0 h-auto text-primary"
          onClick={() => router.push('/auth/signup')}
        >
          Sign up
        </Button>
      </div>
    </AuthFormLayout>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <SignInForm />
    </Suspense>
  )
}
