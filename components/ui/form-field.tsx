import { Label } from './label'
import { Input } from './input'
import { Textarea } from './textarea'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  id: string
  type?: 'text' | 'email' | 'password' | 'textarea'
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  required?: boolean
  disabled?: boolean
  minLength?: number
  className?: string
  inputClassName?: string
  error?: string
  helperText?: string
}

export function FormField({ 
  label, 
  id, 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  required, 
  disabled, 
  minLength,
  className,
  inputClassName,
  error,
  helperText
}: FormFieldProps) {
  const InputComponent = type === 'textarea' ? Textarea : Input

  return (
    <div className={cn('form-control space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <InputComponent
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        minLength={minLength}
        className={inputClassName}
      />
      {helperText && (
        <p className="label-text-alt text-xs text-muted-foreground">{helperText}</p>
      )}
      {error && (
        <p className="label-text-alt text-xs text-error">{error}</p>
      )}
    </div>
  )
}



