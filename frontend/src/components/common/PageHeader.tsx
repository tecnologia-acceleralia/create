import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, icon: Icon, className, actions }: Props) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 px-6 py-5 shadow-sm backdrop-blur-sm',
        'before:pointer-events-none before:absolute before:-left-16 before:top-1/2 before:h-32 before:w-32 before:-translate-y-1/2 before:rounded-full before:bg-[color:var(--tenant-accent)]/10',
        'after:pointer-events-none after:absolute after:-right-10 after:top-1/2 after:h-24 after:w-24 after:-translate-y-1/2 after:rounded-full after:bg-[color:var(--tenant-primary)]/15',
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          {Icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/15 text-[color:var(--tenant-primary)]">
              <Icon className="h-6 w-6" />
            </div>
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}