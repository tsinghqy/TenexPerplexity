import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  message: string
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  if (!message) return null

  return (
    <div className={cn(
      'alert alert-error border border-error/20 bg-error/15 text-sm text-error-content shadow-sm',
      className
    )}>
      <span>{message}</span>
    </div>
  )
}



