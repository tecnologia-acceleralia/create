import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type FormGridProps = {
  columns?: 1 | 2 | 3 | 4;
  gap?: string;
  className?: string;
  children: ReactNode;
};

const columnsMap: Record<NonNullable<FormGridProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-4'
};

export function FormGrid({ columns = 1, gap = 'gap-4', className, children }: FormGridProps) {
  return (
    <div className={cn('grid', gap, columnsMap[columns], className)}>
      {children}
    </div>
  );
}


