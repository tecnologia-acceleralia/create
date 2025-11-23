import { cn } from '@/utils/cn';

type Props = {
  fullHeight?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function Spinner({ fullHeight = false, size = 'md', className }: Props) {
  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-10 w-10 border-b-2 border-t-2',
    lg: 'h-16 w-16 border-b-4 border-t-4'
  };

  return (
    <div className={cn('flex items-center justify-center', fullHeight && 'min-h-[200px]', className)}
      role="status"
      aria-live="polite"
    >
      <div className={cn('animate-spin rounded-full border-primary', sizeClasses[size])} />
    </div>
  );
}

