import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'textarea textarea-bordered flex min-h-16 w-full rounded-2xl border-white/10 bg-base-200/70 px-3 py-2 text-sm text-base-content shadow-sm transition-all duration-200',
        'field-sizing-content placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/20',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }



