import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type SuperAdminToolbarProps = {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
};

export function SuperAdminToolbar({ start, end, className }: SuperAdminToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-md border border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">{start}</div>
      {end ? <div className="flex flex-wrap gap-2">{end}</div> : null}
    </div>
  );
}

