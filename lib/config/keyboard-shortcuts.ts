/**
 * Keyboard shortcuts configuration
 * Single source of truth for all keyboard shortcuts in the application
 */

export interface KeyboardShortcutDefinition {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  category: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcutDefinition[] = [
  {
    key: 'n',
    metaKey: true,
    description: 'Create new chat node at viewport center',
    category: 'General',
  },
  {
    key: 'n',
    metaKey: true,
    shiftKey: true,
    description: 'Create new chat node at viewport center',
    category: 'General',
  },
  {
    key: 'i',
    metaKey: true,
    description: 'Focus search input (or create new node as fallback)',
    category: 'General',
  },
  {
    key: 'k',
    metaKey: true,
    description: 'Focus chat list search',
    category: 'Navigation',
  },
  {
    key: 'b',
    metaKey: true,
    description: 'Toggle sidebar visibility',
    category: 'Navigation',
  },
  {
    key: 'o',
    metaKey: true,
    description: 'Focus chat input (when chat is open)',
    category: 'Navigation',
  },
  {
    key: 'Escape',
    description: 'Close expanded node or exit fullscreen',
    category: 'Navigation',
  },
  {
    key: 'f',
    metaKey: true,
    shiftKey: true,
    description: 'Toggle fullscreen mode (works even when typing)',
    category: 'Navigation',
  },
  {
    key: 'Delete',
    description: 'Delete selected chat node',
    category: 'Actions',
  },
]

/**
 * Format a keyboard shortcut for display
 */
export function formatKeyboardShortcut(shortcut: KeyboardShortcutDefinition): string {
  const parts: string[] = []
  
  if (shortcut.metaKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
  } else if (shortcut.ctrlKey) {
    parts.push('Ctrl')
  }
  
  if (shortcut.shiftKey) {
    parts.push('Shift')
  }
  
  if (shortcut.altKey) {
    parts.push('Alt')
  }
  
  // Format the key itself
  const keyDisplay = shortcut.key === 'Escape' 
    ? 'Esc' 
    : shortcut.key.length === 1 
      ? shortcut.key.toUpperCase() 
      : shortcut.key
  
  parts.push(keyDisplay)
  
  return parts.join(' + ')
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(): Record<string, KeyboardShortcutDefinition[]> {
  const grouped: Record<string, KeyboardShortcutDefinition[]> = {}
  
  KEYBOARD_SHORTCUTS.forEach(shortcut => {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = []
    }
    grouped[shortcut.category].push(shortcut)
  })
  
  return grouped
}

/**
 * Find a keyboard shortcut by description (partial match)
 * Returns the first matching shortcut
 */
export function findShortcutByDescription(description: string): KeyboardShortcutDefinition | undefined {
  const lowerDescription = description.toLowerCase()
  return KEYBOARD_SHORTCUTS.find(shortcut => 
    shortcut.description.toLowerCase().includes(lowerDescription)
  )
}

/**
 * Find a keyboard shortcut by key and modifiers
 * Returns the first matching shortcut
 */
export function findShortcutByKey(
  key: string,
  options?: {
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  }
): KeyboardShortcutDefinition | undefined {
  return KEYBOARD_SHORTCUTS.find(shortcut => {
    if (shortcut.key !== key) return false
    if (options?.metaKey !== undefined && shortcut.metaKey !== options.metaKey) return false
    if (options?.ctrlKey !== undefined && shortcut.ctrlKey !== options.ctrlKey) return false
    if (options?.shiftKey !== undefined && shortcut.shiftKey !== options.shiftKey) return false
    if (options?.altKey !== undefined && shortcut.altKey !== options.altKey) return false
    return true
  })
}
