import type { ReactNode } from 'react';

type ErrorDisplayProps = {
  error: string | ReactNode | null;
  className?: string;
};

export function ErrorDisplay({ error, className }: ErrorDisplayProps) {
  if (!error) {
    return null;
  }

  return (
    <div className={`rounded-md bg-destructive/10 border border-destructive/20 p-3 ${className ?? ''}`}>
      {typeof error === 'string' ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : (
        error
      )}
    </div>
  );
}

