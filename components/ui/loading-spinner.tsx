import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export function LoadingSpinner({ 
  className, 
  size = 'md',
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinner = (
    <span
      className={cn(
        'loading loading-spinner text-primary',
        size === 'sm' && 'loading-sm',
        size === 'md' && 'loading-md',
        size === 'lg' && 'loading-lg',
        className
      )}
    />
  )

  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center">{spinner}</div>
  }

  return spinner
}

