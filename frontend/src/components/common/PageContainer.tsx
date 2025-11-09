import type { ReactNode } from "react";
import { cn } from '@/utils/cn';

type Props = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: Props) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
