import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface AuthFormLayoutProps {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
  className?: string
  cardClassName?: string
  showBackground?: boolean
}

export function AuthFormLayout({
  title,
  description,
  icon,
  children,
  className,
  cardClassName,
  showBackground = true,
}: AuthFormLayoutProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden bg-base-100 px-4 py-8',
        className
      )}
    >
      {showBackground && (
        <>
          <div className="absolute left-1/2 top-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />
        </>
      )}

      <Card className={cn('w-full max-w-md border-white/10 bg-base-200/92', cardClassName)}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-3xl border border-primary/15 bg-primary/12 p-3 text-primary shadow-lg shadow-primary/10">
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
        </CardHeader>

        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
