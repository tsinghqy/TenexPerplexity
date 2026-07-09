import * as React from 'react'

import { cn } from '@/lib/utils'

const baseButtonClassName =
  'btn border-white/10 shadow-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0'

const buttonVariantClassNames = {
  default: 'btn-primary',
  destructive: 'btn-error text-error-content hover:bg-error/90',
  outline: 'btn-outline border-white/10 bg-base-200/80 hover:bg-base-300 hover:border-white/20',
  secondary: 'btn-neutral bg-base-300 text-base-content hover:bg-base-300/90',
  ghost: 'btn-ghost hover:bg-base-300/70 hover:text-base-content',
  link: 'btn-link min-h-0 h-auto px-0 text-primary no-underline hover:underline',
} as const

const buttonSizeClassNames = {
  default: 'btn-md min-h-10 h-10 px-4',
  sm: 'btn-sm min-h-8 h-8 px-3',
  lg: 'btn-lg min-h-11 h-11 px-6',
  icon: 'btn-square min-h-10 h-10 w-10 p-0',
  'icon-sm': 'btn-square min-h-8 h-8 w-8 p-0',
  'icon-lg': 'btn-square min-h-11 h-11 w-11 p-0',
} as const

type ButtonVariant = keyof typeof buttonVariantClassNames
type ButtonSize = keyof typeof buttonSizeClassNames

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(
          baseButtonClassName,
          buttonVariantClassNames[variant],
          buttonSizeClassNames[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
