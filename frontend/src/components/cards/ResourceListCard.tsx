import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type ResourceListCardProps<T> = {
  title: string;
  description?: string;
  items?: T[];
  renderItem: (item: T) => ReactNode;
  emptyMessage?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ResourceListCard<T>({
  title,
  description,
  items = [],
  renderItem,
  emptyMessage,
  actions,
  className,
  contentClassName
}: ResourceListCardProps<T>) {
  const hasItems = items.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn('space-y-3', contentClassName)}>
        {hasItems
          ? items.map(item => renderItem(item))
          : emptyMessage ?? <p className="text-sm text-muted-foreground">—</p>}
      </CardContent>
    </Card>
  );
}


