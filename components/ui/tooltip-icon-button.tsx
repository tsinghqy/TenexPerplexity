'use client'

import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/utils'
import { formatKeyboardShortcut, type KeyboardShortcutDefinition } from '@/lib/config/keyboard-shortcuts'

interface TooltipIconButtonProps {
  icon: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  tooltipText: string
  keyboardShortcut?: KeyboardShortcutDefinition | null
  ariaLabel: string
  className?: string
  buttonClassName?: string
}

export function TooltipIconButton({
  icon,
  onClick,
  tooltipText,
  keyboardShortcut,
  ariaLabel,
  className,
  buttonClassName,
}: TooltipIconButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(e)
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <IconButton
          onClick={handleClick}
          className={cn(
            'h-16 w-16 md:h-10 md:w-10',
            'bg-background/95 backdrop-blur-sm',
            'shadow-lg border border-border/50',
            'hover:scale-105',
            'transition-all duration-200',
            buttonClassName
          )}
          aria-label={ariaLabel}
        >
          {icon}
        </IconButton>
      </TooltipTrigger>
      <TooltipContent className={className}>
        <p>
          {tooltipText}
          {keyboardShortcut && (
            <span className="ml-2 text-muted-foreground">
              ({formatKeyboardShortcut(keyboardShortcut)})
            </span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
