'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

const DialogContext = React.createContext<{ onOpenChange: (open: boolean) => void } | null>(null)

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <DialogContext.Provider value={{ onOpenChange }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      >
        <div className="contents" onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    document.body
  )
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        'relative z-50 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-[calc(var(--radius)+0.5rem)] border border-white/10 bg-base-200/95 shadow-2xl shadow-black/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div className={cn('flex flex-col space-y-1.5 px-6 pt-6 pb-4', className)} {...props} />
}

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <h2 className={cn('text-lg font-semibold text-base-content', className)} {...props} />
}

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function DialogClose({ onClose }: { onClose: () => void }) {
  const dialogContext = React.useContext(DialogContext)

  const handleClick = () => {
    onClose()
    dialogContext?.onOpenChange(false)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-4 top-4 rounded-full border border-transparent bg-base-200/70 text-muted-foreground hover:border-white/10 hover:bg-base-300/70 hover:text-foreground"
      onClick={handleClick}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </Button>
  )
}

Dialog.Content = DialogContent
Dialog.Header = DialogHeader
Dialog.Title = DialogTitle
Dialog.Description = DialogDescription
Dialog.Close = DialogClose
