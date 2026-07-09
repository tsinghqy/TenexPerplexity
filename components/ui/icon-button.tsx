'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface IconButtonProps extends React.ComponentProps<typeof Button> {
  hoverSurface?: 'dark' | 'none'
}

export function IconButton({
  className,
  hoverSurface = 'dark',
  size = 'icon',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        'rounded-full border border-transparent',
        hoverSurface === 'dark' && 'icon-button-hover-surface',
        className
      )}
      {...props}
    />
  )
}
