'use client'

/**
 * Platform detection utilities
 */

import { useState, useEffect } from 'react'

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown'

/**
 * Detect the user's platform
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') {
    return 'unknown'
  }

  const userAgent = window.navigator.userAgent.toLowerCase()
  const platform = window.navigator.platform.toLowerCase()

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac'
  }

  if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows'
  }

  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux'
  }

  return 'unknown'
}

/**
 * Get the modifier key symbol based on platform
 * Mac: ⌘, Windows/Linux: Ctrl
 */
export function getModifierKey(): string {
  const platform = detectPlatform()
  return platform === 'mac' ? '⌘' : 'Ctrl'
}

/**
 * Get the full keyboard shortcut display text
 * e.g., "⌘K" on Mac, "Ctrl+K" on Windows
 */
export function getKeyboardShortcut(key: string): string {
  const modifier = getModifierKey()
  return `${modifier}${key}`
}

/**
 * Check if the current viewport is mobile (< 768px)
 * Returns false on server-side for SSR safety
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia('(max-width: 767px)').matches
}

/**
 * React hook to detect mobile viewport
 * Updates reactively when viewport size changes
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    setIsMobile(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return isMobile
}

