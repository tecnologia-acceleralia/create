import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type SuperAdminStatsCardProps = {
  label: string;
  primaryValue: number | string;
  secondaryLabel?: string;
  secondaryValue?: number | string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function SuperAdminStatsCard({
  label,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  icon,
  onClick,
  className
}: SuperAdminStatsCardProps) {
  const isInteractive = typeof onClick === 'function';

  return (
    <Card
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : -1}
      onClick={onClick}
      onKeyDown={event => {
        if (!isInteractive) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        'transition-all focus-within:ring-2 focus-within:ring-primary focus:outline-none',
        isInteractive ? 'cursor-pointer hover:border-primary/60 hover:shadow-md' : '',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{primaryValue}</p>
        {secondaryLabel ? (
          <CardDescription className="flex items-center gap-2">
            <span>{secondaryLabel}</span>
            {secondaryValue !== undefined ? (
              <span className="font-medium text-foreground">{secondaryValue}</span>
            ) : null}
          </CardDescription>
        ) : null}
      </CardContent>
    </Card>
  );
}

