'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/utils/platform'
import { safeFocus } from '@/lib/utils/focus-manager'

interface SelectOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
  disabled?: boolean
}

interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface ResponsiveSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  groups?: SelectGroup[]
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  renderTrigger?: (selectedOption: SelectOption | undefined, isOpen: boolean) => React.ReactNode
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode
  searchable?: boolean
  /** Disable automatic focus restoration to trigger after dropdown closes. Set to true when used inside another focusable element. */
  disableFocusRestoration?: boolean
}

/**
 * ResponsiveSelect Component
 * 
 * A reusable select/dropdown component that adapts to viewport size:
 * - Desktop: Standard dropdown menu (Radix UI)
 * - Mobile: Bottom sheet that slides up from bottom with swipe-to-dismiss
 * 
 * Features:
 * - Smooth animations
 * - Swipe-to-dismiss on mobile
 * - Focus restoration on close
 * - Accessible keyboard navigation
 * - Customizable trigger and option rendering
 */
export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  groups,
  placeholder = 'Select...',
  disabled = false,
  triggerClassName,
  contentClassName,
  renderTrigger,
  renderOption,
  searchable = false,
  disableFocusRestoration = false,
}: ResponsiveSelectProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const bottomSheetRef = React.useRef<HTMLDivElement>(null)
  
  const scrollableContainerRef = React.useRef<HTMLDivElement>(null)
  const selectedOptionRef = React.useRef<HTMLButtonElement | null>(null)
  const hasScrolledToSelectedRef = React.useRef(false)
  const [dragY, setDragY] = React.useState(0)
  const dragYRef = React.useRef(0) // Track current dragY for event listeners
  const [isDragging, setIsDragging] = React.useState(false)
  const isDraggingRef = React.useRef(false) // Track dragging state synchronously for event listeners
  const [isClosing, setIsClosing] = React.useState(false)
  const [isOpening, setIsOpening] = React.useState(false)
  const dragStartY = React.useRef(0)
  const dragStartTime = React.useRef(0)
  const sheetOpenedAtRef = React.useRef<number>(0)
  const isOpeningRef = React.useRef<boolean>(false)

  // Flatten all options from groups if groups are provided
  const allOptions = React.useMemo(() => {
    if (groups) {
      return groups.flatMap((group) => group.options)
    }
    return options
  }, [options, groups])

  const selectedOption = allOptions.find((opt) => opt.value === value)

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return allOptions
    }
    const query = searchQuery.toLowerCase()
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query)
    )
  }, [allOptions, searchQuery, searchable])

  // Filter groups based on search query
  const filteredGroups = React.useMemo(() => {
    if (!groups) return undefined
    if (!searchable || !searchQuery.trim()) {
      return groups
    }
    const query = searchQuery.toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(query) ||
            opt.description?.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.options.length > 0)
  }, [groups, searchQuery, searchable])

  // Handle opening animation
  React.useEffect(() => {
    if (isOpen && isMobile) {
      // Mark that we're opening to prevent immediate close from click-outside handler
      isOpeningRef.current = true
      setIsOpening(true)
      // Use requestAnimationFrame to ensure DOM is ready before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpening(false)
          // Clear opening flag after a short delay to allow animation to complete
          setTimeout(() => {
            isOpeningRef.current = false
          }, 350) // Slightly longer than animation duration (300ms)
        })
      })
    } else {
      setIsOpening(false)
      isOpeningRef.current = false
    }
  }, [isOpen, isMobile])

  // Reset scroll flag when sheet closes
  React.useEffect(() => {
    if (!isOpen) {
      hasScrolledToSelectedRef.current = false
    }
  }, [isOpen])

  // Auto-scroll to selected option when bottom sheet opens on mobile
  // Use manual scrolling within the container to prevent page scroll
  React.useEffect(() => {
    if (
      !isMobile ||
      !isOpen ||
      isOpening ||
      hasScrolledToSelectedRef.current ||
      !selectedOptionRef.current ||
      !scrollableContainerRef.current
    ) {
      return
    }

    // Wait for opening animation to complete (300ms) before scrolling
    const scrollTimeout = setTimeout(() => {
      const selectedElement = selectedOptionRef.current
      const scrollContainer = scrollableContainerRef.current
      
      if (selectedElement && scrollContainer) {
        // Calculate scroll position to center the selected option
        const containerRect = scrollContainer.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()
        
        // Calculate the position relative to the scrollable container
        const elementTopRelativeToContainer = elementRect.top - containerRect.top + scrollContainer.scrollTop
        const elementHeight = elementRect.height
        const containerHeight = scrollContainer.clientHeight
        
        // Center the element vertically within the container
        const targetScrollTop = elementTopRelativeToContainer - (containerHeight / 2) + (elementHeight / 2)
        
        // Scroll the container, not the page
        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        })
        
        hasScrolledToSelectedRef.current = true
      }
    }, 10) // Slightly after animation completes

    return () => clearTimeout(scrollTimeout)
  }, [isMobile, isOpen, isOpening])

  // Close bottom sheet with slide-down animation
  const closeBottomSheet = React.useCallback(() => {
    if (!isMobile) {
      setIsOpen(false)
      setSearchQuery('')
      return
    }
    
    // Prevent multiple simultaneous close calls
    if (isClosing || !isOpen) {
      return
    }
    
    // Trigger closing animation
    setIsClosing(true)
    
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
      setSearchQuery('')
      setDragY(0)
      dragYRef.current = 0
    }, 300) // Match animation duration
  }, [isMobile, isClosing, isOpen])

  // Handle value change
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      // Prevent value changes immediately after opening (within 150ms)
      // This prevents click events from the trigger from accidentally selecting options
      const timeSinceOpen = Date.now() - sheetOpenedAtRef.current
      if (timeSinceOpen < 150 && sheetOpenedAtRef.current > 0) {
        return
      }
      
      onValueChange(newValue)
      // Close with smooth animation
      if (isMobile) {
        closeBottomSheet()
      } else {
        setIsOpen(false)
        setSearchQuery('')
      }
    },
    [onValueChange, isMobile, closeBottomSheet]
  )

  // Focus restoration - only if not disabled and dropdown was open
  React.useEffect(() => {
    if (!isOpen && !disableFocusRestoration && triggerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        // Use safeFocus to prevent stealing focus from other elements
        safeFocus(triggerRef.current, { onlyIfNoFocus: true })
      }, 100)
    }
  }, [isOpen, disableFocusRestoration])

  // Touch gesture handling for mobile bottom sheet
  // Use native event listeners with { passive: false } to allow preventDefault()
  React.useEffect(() => {
    if (!isMobile || !isOpen || !bottomSheetRef.current) return

    const sheet = bottomSheetRef.current

    const handleTouchStart = (e: TouchEvent) => {
      // Only start dragging if touch starts near the top of the sheet (drag handle area)
      const touch = e.touches[0]
      const target = e.target as HTMLElement
      
      // Check if touch is in the top 60px (drag handle area) or on the drag handle itself
      const touchY = touch.clientY
      const sheetTop = sheet.getBoundingClientRect().top
      const relativeY = touchY - sheetTop
      
      if (relativeY <= 60 || target.closest('[data-drag-handle]')) {
        dragStartY.current = touch.clientY
        dragStartTime.current = Date.now()
        isDraggingRef.current = true
        setIsDragging(true)
        setDragY(0)
        dragYRef.current = 0
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      
      const touch = e.touches[0]
      const deltaY = touch.clientY - dragStartY.current
      
      // Only allow downward dragging
      if (deltaY > 0) {
        setDragY(deltaY)
        dragYRef.current = deltaY
        e.preventDefault() // Prevent scrolling while dragging
      }
    }

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return
      
      const threshold = 100 // Minimum drag distance to dismiss
      const velocityThreshold = 0.5 // Minimum velocity (px/ms) to dismiss
      
      // Use ref to get current dragY value
      const currentDragY = dragYRef.current
      
      // Calculate velocity
      const dragDuration = Date.now() - dragStartTime.current
      const velocity = currentDragY / Math.max(dragDuration, 1)
      
      if (currentDragY > threshold || (currentDragY > 50 && velocity > velocityThreshold)) {
        // Dismiss the bottom sheet with animation
        closeBottomSheet()
      } else {
        // Snap back to original position
        setDragY(0)
        dragYRef.current = 0
      }
      
      // Reset drag state
      isDraggingRef.current = false
      setIsDragging(false)
      setDragY(0)
      dragYRef.current = 0
    }

    // Attach native event listeners with { passive: false } to allow preventDefault()
    sheet.addEventListener('touchstart', handleTouchStart, { passive: false })
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false })
    sheet.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart)
      sheet.removeEventListener('touchmove', handleTouchMove)
      sheet.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, isOpen, isDragging, closeBottomSheet])

  // Prevent body scroll when bottom sheet is open on mobile
  React.useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isMobile, isOpen])

  // Handle click outside to close bottom sheet on mobile
  React.useEffect(() => {
    if (!isMobile || !isOpen) {
      sheetOpenedAtRef.current = 0
      isOpeningRef.current = false
      return
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      
      // First check if target is the trigger or inside the trigger - if so, don't close
      const isTriggerElement = target.closest('[data-responsive-select-trigger]') !== null
      if (isTriggerElement || triggerRef.current?.contains(target)) {
        return
      }
      
      // Don't close if touch/click is on the bottom sheet itself (allows swipe-to-dismiss to work)
      if (bottomSheetRef.current && bottomSheetRef.current.contains(target)) {
        return
      }
      
      // Check if we're currently in the process of opening - if so, don't close
      if (isOpeningRef.current) {
        return
      }
      
      // Check if we're currently dragging - if so, don't close (allows swipe-to-dismiss to work)
      // Use ref for synchronous check since state updates are asynchronous
      if (isDraggingRef.current) {
        return
      }
      
      // Prevent closing if this event happened too soon after opening (within 300ms)
      // This prevents the touch event that opened the sheet from also closing it
      const timeSinceOpen = Date.now() - sheetOpenedAtRef.current
      if (timeSinceOpen < 300 && sheetOpenedAtRef.current > 0) {
        return
      }
      
      // Check if click is outside the bottom sheet (this should now always be true due to check above)
      if (bottomSheetRef.current && !bottomSheetRef.current.contains(target)) {
        closeBottomSheet()
      }
    }

    // Add event listeners with a delay to avoid immediate close on open
    // Only listen to mousedown for desktop - backdrop handles mobile touch events
    // This prevents interference with swipe gestures
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true) // Capture phase for desktop
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [isMobile, isOpen, closeBottomSheet])

  // Default trigger renderer
  const defaultRenderTrigger = React.useCallback(
    (selected: SelectOption | undefined, open: boolean) => (
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          'group flex w-fit max-w-full min-w-0 items-center justify-between overflow-hidden',
          'rounded-full border border-white/10 bg-base-200/80 text-left text-sm text-base-content shadow-sm transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          'hover:text-foreground cursor-pointer',
          'px-3 py-1.5 gap-2',
          'hover:border-white/20 hover:bg-base-300/80',
          disabled && 'opacity-50 cursor-not-allowed',
          triggerClassName
        )}
      >
        <span className="truncate flex-1 text-left font-medium text-xs">
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground/70',
            open && 'rotate-180 text-muted-foreground'
          )}
        />
      </button>
    ),
    [placeholder, disabled, triggerClassName]
  )

  // Default option renderer
  const defaultRenderOption = React.useCallback(
    (option: SelectOption, isSelected: boolean) => (
      <div
        className={cn(
          'flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer',
          'transition-all duration-150 relative',
          !isSelected && 'hover:bg-base-300/60 focus:bg-base-300/60',
          isSelected && [
            'bg-primary/12 ring-1 ring-primary/20',
            'hover:bg-primary/18 focus:bg-primary/18',
          ],
          option.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span
              className={cn(
                'text-sm font-medium truncate',
                isSelected ? 'text-primary' : 'text-foreground'
              )}
            >
              {option.label}
            </span>
          </div>
          {option.description && (
            <span className="text-xs text-muted-foreground truncate">
              {option.description}
            </span>
          )}
        </div>
        {isSelected && (
          <Check
            className={cn(
              'h-4 w-4 shrink-0 ml-2 mt-0.5',
              'text-primary transition-all duration-200'
            )}
          />
        )}
      </div>
    ),
    []
  )

  // Desktop: Use Radix DropdownMenu
  if (!isMobile) {
    return (
      <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuPrimitive.Trigger asChild>
          {renderTrigger
            ? renderTrigger(selectedOption, isOpen)
            : defaultRenderTrigger(selectedOption, isOpen)}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            className={cn(
              'z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-white/10 bg-base-200/95 p-1.5',
              'text-base-content shadow-xl shadow-black/20 backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-2',
              'w-[220px] md:w-[260px] max-h-[320px] overflow-y-auto',
              contentClassName
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {searchable && (
              <div className="border-b border-white/10 px-2 py-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="input input-bordered h-10 w-full rounded-xl border-white/10 bg-base-100/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {filteredGroups ? (
              filteredGroups.map((group, groupIndex) => (
                <React.Fragment key={group.label}>
                  <div className="border-b border-white/10 bg-base-300/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                    {group.label}
                  </div>
                  {group.options.map((option) => (
                    <DropdownMenuPrimitive.Item
                      key={option.value}
                      disabled={option.disabled}
                      onClick={() => !option.disabled && handleValueChange(option.value)}
                      className="p-0 cursor-pointer"
                    >
                      {renderOption
                        ? renderOption(option, option.value === value)
                        : defaultRenderOption(option, option.value === value)}
                    </DropdownMenuPrimitive.Item>
                  ))}
                  {groupIndex < filteredGroups.length - 1 && (
                    <div className="my-1 h-px bg-white/8" />
                  )}
                </React.Fragment>
              ))
            ) : (
              filteredOptions.map((option) => (
                <DropdownMenuPrimitive.Item
                  key={option.value}
                  disabled={option.disabled}
                  onClick={() => !option.disabled && handleValueChange(option.value)}
                  className="p-0 cursor-pointer"
                >
                  {renderOption
                    ? renderOption(option, option.value === value)
                    : defaultRenderOption(option, option.value === value)}
                </DropdownMenuPrimitive.Item>
              ))
            )}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    )
  }

  // Mobile: Bottom sheet
  const mobileBottomSheet = isOpen && (
    <>
      {/* Backdrop - Clickable to close, behind the sheet */}
      <div
        className={cn(
          'fixed inset-0 z-[10000] md:hidden bg-black/50 transition-opacity duration-300',
          'cursor-pointer', // Make it clear it's clickable
          isDragging && 'opacity-30',
          isClosing && 'opacity-0'
        )}
        onClick={(e) => {
          // Close when clicking directly on backdrop
          // Prevent closing if sheet was just opened (within 300ms)
          const timeSinceOpen = Date.now() - sheetOpenedAtRef.current
          if (timeSinceOpen < 300) {
            return
          }
          if (e.target === e.currentTarget) {
            closeBottomSheet()
          }
        }}
        onPointerDown={(e) => {
          // Close on backdrop pointer down
          // Prevent closing if sheet was just opened (within 300ms)
          const timeSinceOpen = Date.now() - sheetOpenedAtRef.current
          if (timeSinceOpen < 300) {
            return
          }
          if (e.target === e.currentTarget) {
            closeBottomSheet()
          }
        }}
      />

      {/* Bottom Sheet Container - Higher z-index than fullscreen overlay (z-[9999]) */}
      <div
        className="fixed inset-0 z-[10010] md:hidden pointer-events-none"
      >
            {/* Bottom Sheet */}
            <div
              ref={bottomSheetRef}
              className={cn(
                'absolute bottom-0 left-0 right-0 border-t border-white/10 bg-base-200/98',
                'rounded-t-[1.75rem] shadow-2xl shadow-black/30 backdrop-blur-sm',
                'flex flex-col',
                'transition-transform duration-300 ease-out',
                'pointer-events-auto', // Re-enable pointer events for the sheet
                isDragging && 'transition-none'
              )}
              style={{
                transform: isDragging 
                  ? `translateY(${dragY}px)` 
                  : isClosing 
                    ? 'translateY(100%)' 
                    : isOpening
                      ? 'translateY(100%)'
                      : 'translateY(0)',
                maxHeight: '70vh',
                height: 'auto',
                minHeight: '200px', // Ensure minimum height for usability
              }}
              onClick={(e) => {
                e.stopPropagation()
                // Prevent clicks from propagating
              }}
              onMouseDown={(e) => {
                // Prevent mousedown events during opening to avoid accidental option selection
                if (isOpeningRef.current) {
                  e.stopPropagation()
                  e.preventDefault()
                }
              }}
              onTouchStart={(e) => {
                // Prevent touchstart events during opening to avoid accidental option selection
                if (isOpeningRef.current) {
                  e.stopPropagation()
                  e.preventDefault()
                }
              }}
            >
            {/* Drag Handle - Always visible at top */}
            <div 
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing flex-shrink-0"
              data-drag-handle
            >
              <div className="h-1 w-12 rounded-full bg-base-content/20" />
            </div>

            {/* Search - Fixed height, not scrollable */}
            {searchable && (
              <div className="border-b border-white/10 px-4 py-3 flex-shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="input input-bordered h-11 w-full rounded-2xl border-white/10 bg-base-100/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Options List - Scrollable area with max height */}
            <div 
              ref={scrollableContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain min-h-0"
              style={{
                // Reserve space: drag handle (~40px) + search (~60px if enabled) + padding
                maxHeight: searchable 
                  ? 'calc(70vh - 100px)' 
                  : 'calc(70vh - 60px)',
              }}
            >
              {filteredGroups ? (
                filteredGroups.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No options found
                  </div>
                ) : (
                  filteredGroups.map((group, groupIndex) => (
                    <div key={group.label}>
                      <div className="sticky top-0 z-10 border-b border-white/10 bg-base-200/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 backdrop-blur-sm">
                        {group.label}
                      </div>
                      {group.options.map((option) => (
                        <button
                          key={option.value}
                          ref={option.value === value ? selectedOptionRef : null}
                          type="button"
                          disabled={option.disabled}
                          onClick={() => !option.disabled && handleValueChange(option.value)}
                          className="w-full text-left"
                        >
                          {renderOption
                            ? renderOption(option, option.value === value)
                            : defaultRenderOption(option, option.value === value)}
                        </button>
                      ))}
                      {groupIndex < filteredGroups.length - 1 && (
                        <div className="my-1 h-px bg-white/8" />
                      )}
                    </div>
                  ))
                )
              ) : filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    ref={option.value === value ? selectedOptionRef : null}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => !option.disabled && handleValueChange(option.value)}
                    className="w-full text-left"
                  >
                    {renderOption
                      ? renderOption(option, option.value === value)
                      : defaultRenderOption(option, option.value === value)}
                  </button>
                ))
              )}
            </div>
            </div>
          </div>
    </>
  )

  return (
    <>
      {renderTrigger ? (
        <div 
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (!disabled) {
              isOpeningRef.current = true
              sheetOpenedAtRef.current = Date.now()
              setIsOpen(true)
            }
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            if (!disabled) {
              isOpeningRef.current = true
              sheetOpenedAtRef.current = Date.now()
              setIsOpen(true)
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {renderTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          data-responsive-select-trigger="true"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (!disabled) {
              isOpeningRef.current = true
              sheetOpenedAtRef.current = Date.now()
              setIsOpen(true)
            }
          }}
          onTouchStart={(e) => {
            // On mobile, handle touch directly to ensure dropdown opens
            // This bypasses any click event issues
            if (!disabled) {
              e.stopPropagation()
              isOpeningRef.current = true
              sheetOpenedAtRef.current = Date.now()
              setIsOpen(true)
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'group flex w-fit max-w-full min-w-0 items-center justify-between overflow-hidden',
            'rounded-full border border-white/10 bg-base-200/80 text-left text-sm text-base-content shadow-sm transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            'hover:text-foreground cursor-pointer',
            'px-3 py-1.5 gap-2',
            'hover:border-white/20 hover:bg-base-300/80',
            disabled && 'opacity-50 cursor-not-allowed',
            triggerClassName
          )}
        >
          <span className="truncate flex-1 text-left font-medium text-xs">
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground/70',
              isOpen && 'rotate-180 text-muted-foreground'
            )}
          />
        </button>
      )}

      {/* Mobile Bottom Sheet - Portal to document.body to escape parent stacking contexts */}
      {typeof window !== 'undefined' && mobileBottomSheet && createPortal(mobileBottomSheet, document.body)}
    </>
  )
}
