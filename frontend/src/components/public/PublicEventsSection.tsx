import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type PublicEventsSectionProps<T> = {
  title: ReactNode;
  events: T[];
  renderEvent: (event: T) => ReactNode;
  emptyMessage?: ReactNode;
  className?: string;
  gridClassName?: string;
};

export function PublicEventsSection<T>({
  title,
  events,
  renderEvent,
  emptyMessage,
  className,
  gridClassName
}: PublicEventsSectionProps<T>) {
  const hasEvents = events.length > 0;

  return (
    <section className={cn('px-6 pb-16', className)}>
      <div className="mx-auto max-w-5xl space-y-6">
        <h2 className="text-2xl font-semibold text-[color:var(--tenant-secondary)]">{title}</h2>
        {hasEvents ? (
          <div className={cn('grid gap-4 md:grid-cols-2', gridClassName)}>{events.map(renderEvent)}</div>
        ) : (
          emptyMessage ?? <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </section>
  );
}


