'use client'

import React from 'react'
import { getKeyboardShortcut } from '@/lib/utils/platform'
import { formatKeyboardShortcut, type KeyboardShortcutDefinition } from '@/lib/config/keyboard-shortcuts'
import { cn } from '@/lib/utils'

export interface KeyboardShortcutProps {
  /**
   * The key to display (e.g., 'K', 'Enter')
   * OR a KeyboardShortcutDefinition object
   * OR a pre-formatted shortcut string (e.g., "⌘ + Shift + F")
   */
  shortcutKey?: string
  /**
   * Keyboard shortcut definition from config
   */
  shortcut?: KeyboardShortcutDefinition
  /**
   * Pre-formatted shortcut string (e.g., "⌘ + Shift + F" or "Esc")
   */
  formattedShortcut?: string
  /**
   * Whether to show the meta key (Cmd/Ctrl) - only used when shortcutKey is provided
   */
  showModifier?: boolean
  /**
   * Additional className
   */
  className?: string
}

/**
 * Component to display a keyboard shortcut indicator
 * Automatically detects platform and shows ⌘ on Mac, Ctrl on Windows/Linux
 * Automatically hides on mobile (< 768px) - mobile users don't need keyboard shortcuts
 */
export function KeyboardShortcut({
  shortcutKey,
  shortcut,
  formattedShortcut,
  showModifier = true,
  className,
}: KeyboardShortcutProps) {
  // Determine the display text
  let displayText: string
  
  if (formattedShortcut) {
    displayText = formattedShortcut
  } else if (shortcut) {
    displayText = formatKeyboardShortcut(shortcut)
  } else if (shortcutKey) {
    displayText = showModifier
      ? getKeyboardShortcut(shortcutKey)
      : shortcutKey
  } else {
    return null
  }

  // Split by " + " to handle multi-key shortcuts
  const parts = displayText.split(' + ').map(p => p.trim()).filter(Boolean)

  return (
    <kbd
      className={cn(
        'pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded-full border border-border/70 bg-background/70 px-2 font-mono text-[11px] font-medium text-muted-foreground/90 backdrop-blur',
        className
      )}
    >
      {parts.map((part, partIndex) => (
        <React.Fragment key={partIndex}>
          <span>{part}</span>
          {partIndex < parts.length - 1 && <span className="text-[9px] opacity-70">+</span>}
        </React.Fragment>
      ))}
    </kbd>
  )
}
