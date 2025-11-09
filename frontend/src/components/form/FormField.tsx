import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  className,
  children
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label ? (
        <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </label>
      ) : null}
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}


