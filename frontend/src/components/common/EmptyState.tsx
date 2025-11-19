import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type EmptyStateProps = {
  message?: string | ReactNode;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({ message, className, children }: EmptyStateProps) {
  if (children) {
    return <div className={cn('text-sm text-muted-foreground', className)}>{children}</div>;
  }

  if (!message) {
    return <p className={cn('text-sm text-muted-foreground', className)}>—</p>;
  }

  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {typeof message === 'string' ? message : message}
    </p>
  );
}

