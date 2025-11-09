import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type PublicHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  logoUrl?: string | null;
  logoAlt?: string;
  actions?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
  withBackground?: boolean;
};

const alignmentMap: Record<NonNullable<PublicHeroProps['align']>, string> = {
  center: 'items-center text-center',
  left: 'items-start text-left'
};

export function PublicHero({
  title,
  subtitle,
  logoUrl,
  logoAlt,
  actions,
  align = 'center',
  className,
  withBackground = true
}: PublicHeroProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-6 px-6 py-16',
        withBackground ? 'bg-gradient-to-br from-background via-white to-background' : '',
        alignmentMap[align],
        className
      )}
    >
      {logoUrl ? <img src={logoUrl} alt={logoAlt ?? ''} className="h-20 w-auto" /> : null}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-[color:var(--tenant-primary)] sm:text-5xl">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-lg text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap justify-center gap-3 sm:justify-start">{actions}</div> : null}
    </section>
  );
}


