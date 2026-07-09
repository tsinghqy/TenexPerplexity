'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth/client'
import { useAuthForm } from '@/lib/hooks/useAuthForm'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { ErrorMessage } from '@/components/ui/error-message'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AuthFormLayout } from '@/components/auth/AuthFormLayout'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search } from 'lucide-react'

function SignUpForm() {
  const router = useRouter()
  const { loading, setLoading, error, setError, authLoading, user } = useAuthForm()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await signUp(email, password)

      if (error) {
        setError(error.message || 'An error occurred during sign up')
        setLoading(false)
        return
      }

      if (data?.user) {
        // If email confirmation is disabled, session may already exist
        if (data.session) {
          window.location.href = '/'
          return
        }
        setSuccess(true)
        setLoading(false)
      }
    } catch (err) {
      console.error('Sign up error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (authLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (user) {
    return null
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 mx-auto">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent you a confirmation link. Please check your email to verify your
              account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <AuthFormLayout
      title="Create an account"
      description="Sign up to get started with Tenexity"
      icon={<Search className="h-8 w-8 text-primary" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorMessage message={error} />

        <FormField
          label="Email"
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <FormField
          label="Password"
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
        />

        <FormField
          label="Confirm Password"
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Button
          variant="link"
          className="p-0 h-auto text-primary"
          onClick={() => router.push('/auth/signin')}
        >
          Sign in
        </Button>
      </div>
    </AuthFormLayout>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <SignUpForm />
    </Suspense>
  )
}
