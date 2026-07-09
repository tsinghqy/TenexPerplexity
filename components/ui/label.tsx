'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

function Label({
  className,
  ...props
}: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'label-text flex items-center gap-2 text-sm font-medium text-base-content/90 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
