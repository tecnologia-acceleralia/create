import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
};

export function PageHeader({ title, subtitle, icon: Icon, className }: Props) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-3">
        {Icon ? <Icon className="h-8 w-8 text-primary" /> : null}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      </div>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}

