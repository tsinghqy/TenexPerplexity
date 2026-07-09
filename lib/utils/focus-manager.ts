/**
 * Focus Management Utility
 *
 * Provides coordination for focus management across components to prevent
 * focus stealing and race conditions.
 *
 * Problem: Multiple components call .focus() without checking if focus
 * should actually be moved, causing focus to bounce between elements.
 *
 * Solution: Guard functions that check before focusing.
 */

/**
 * Check if an element should receive focus based on current state
 *
 * @param element - Element that wants to receive focus
 * @param options - Options for focus decision
 * @returns true if focus should be moved to the element
 */
export function shouldFocusElement(
  element: HTMLElement | null,
  options: {
    /** If true, only focus if no other element currently has focus */
    onlyIfNoFocus?: boolean
    /** If true, don't focus if current element is within this container */
    respectContainer?: HTMLElement | null
    /** If true, allow focus even if element already focused */
    force?: boolean
  } = {}
): boolean {
  if (!element) return false

  const { onlyIfNoFocus = false, respectContainer = null, force = false } = options

  // If element already has focus and not forcing, no need to focus again
  if (!force && document.activeElement === element) {
    return false
  }

  // If onlyIfNoFocus is true, don't steal focus from another element
  if (onlyIfNoFocus && document.activeElement && document.activeElement !== document.body) {
    return false
  }

  // If respectContainer is set, don't steal focus if active element is within container
  if (respectContainer && document.activeElement) {
    if (respectContainer.contains(document.activeElement)) {
      return false
    }
  }

  return true
}

/**
 * Safely focus an element with guards
 *
 * @param element - Element to focus
 * @param options - Focus options
 * @returns true if focus was applied, false if prevented
 */
export function safeFocus(
  element: HTMLElement | null,
  options: {
    onlyIfNoFocus?: boolean
    respectContainer?: HTMLElement | null
    force?: boolean
    preventScroll?: boolean
  } = {}
): boolean {
  if (!shouldFocusElement(element, options)) {
    return false
  }

  try {
    element?.focus({ preventScroll: options.preventScroll ?? true })
    return true
  } catch (error) {
    console.warn('Failed to focus element:', error)
    return false
  }
}

/**
 * Check if focus is currently within a specific container
 *
 * @param container - Container element to check
 * @returns true if active element is within container
 */
export function isFocusWithin(container: HTMLElement | null): boolean {
  if (!container) return false
  return container.contains(document.activeElement)
}

/**
 * Debounced focus manager to prevent rapid focus changes
 * Only the last focus request within the debounce window wins
 */
class FocusDebouncer {
  private timeoutId: NodeJS.Timeout | null = null
  private readonly debounceMs: number

  constructor(debounceMs: number = 50) {
    this.debounceMs = debounceMs
  }

  /**
   * Request focus on an element with debouncing
   * If multiple requests come in quickly, only the last one wins
   */
  requestFocus(
    element: HTMLElement | null,
    options: {
      onlyIfNoFocus?: boolean
      respectContainer?: HTMLElement | null
      force?: boolean
    } = {}
  ): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      safeFocus(element, options)
      this.timeoutId = null
    }, this.debounceMs)
  }

  /**
   * Cancel any pending focus request
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

/**
 * Create a debounced focus manager instance
 * Use this when multiple components might try to focus rapidly
 */
export function createFocusDebouncer(debounceMs: number = 50): FocusDebouncer {
  return new FocusDebouncer(debounceMs)
}
