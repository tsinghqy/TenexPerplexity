'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Dialog } from './dialog'
import { Button } from './button'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const AlertDialogContext = React.createContext<{ onOpenChange: (open: boolean) => void } | null>(null)

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </AlertDialogContext.Provider>
  )
}

function AlertDialogTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogOverlay() {
  return null
}

function AlertDialogContent({ className, children, ...props }: AlertDialogContentProps) {
  return (
    <Dialog.Content className={cn('max-w-md', className)} {...props}>
      {children}
    </Dialog.Content>
  )
}

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 px-6 pt-6 text-left', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<'h2'>>(
  ({ className, ...props }, ref) => <h2 ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
)
AlertDialogTitle.displayName = 'AlertDialogTitle'

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<'p'>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
)
AlertDialogDescription.displayName = 'AlertDialogDescription'

const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const alertDialogContext = React.useContext(AlertDialogContext)

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        alertDialogContext?.onOpenChange(false)
      }
    }

    return (
      <Button
        ref={ref}
        className={className}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
AlertDialogAction.displayName = 'AlertDialogAction'

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const alertDialogContext = React.useContext(AlertDialogContext)

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        alertDialogContext?.onOpenChange(false)
      }
    }

    return (
      <Button
        ref={ref}
        variant="outline"
        className={className}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
AlertDialogCancel.displayName = 'AlertDialogCancel'

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
