import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface UseAuthFormOptions {
  onSuccess?: () => void
  redirectPath?: string
}

export function useAuthForm({ onSuccess, redirectPath }: UseAuthFormOptions = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getRedirectPath = useCallback(() => {
    const rawRedirect = searchParams.get('redirect') || redirectPath || '/'
    return rawRedirect.startsWith('/auth') || rawRedirect === ''
      ? '/'
      : rawRedirect
  }, [searchParams, redirectPath])

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getRedirectPath())
    }
  }, [user, authLoading, router, getRedirectPath])

  const handleRedirect = () => {
    window.location.href = getRedirectPath()
  }

  return {
    loading,
    setLoading,
    error,
    setError,
    authLoading,
    user,
    handleRedirect,
    getRedirectPath,
    onSuccess: onSuccess || handleRedirect,
  }
}
