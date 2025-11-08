import { cn } from '@/utils/cn';

type Props = {
  fullHeight?: boolean;
};

export function Spinner({ fullHeight = false }: Props) {
  return (
    <div className={cn('flex items-center justify-center', fullHeight && 'min-h-[200px]')}
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
    </div>
  );
}

