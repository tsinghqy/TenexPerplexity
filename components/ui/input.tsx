import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        ref={ref}
        className={cn(
          'input input-bordered h-10 w-full min-w-0 rounded-xl border-white/10 bg-base-200/70 px-3 text-sm text-base-content shadow-sm transition-all duration-200',
          'placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/20',
          className,
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
