import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type PublicHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  logoUrl?: string | null;
  logoAlt?: string;
  logoBackgroundColor?: string | null;
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
  logoBackgroundColor,
  actions,
  align = 'center',
  className,
  withBackground = true
}: PublicHeroProps) {
  const backgroundClass = withBackground
    ? 'rounded-3xl bg-[color:var(--landing-surface)] p-8 shadow-xl backdrop-blur'
    : '';

  return (
    <section
      className={cn(
        'mx-auto mb-8 flex w-full max-w-5xl flex-col gap-6 px-6 py-16 text-[color:var(--landing-foreground)]',
        backgroundClass,
        alignmentMap[align],
        className
      )}
    >
      {logoUrl ? (
        logoBackgroundColor ? (
          <div
            className="flex h-20 w-auto items-center justify-center rounded border border-border p-2"
            style={{ backgroundColor: logoBackgroundColor }}
          >
            <img src={logoUrl} alt={logoAlt ?? ''} className="h-full w-auto max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <img src={logoUrl} alt={logoAlt ?? ''} className="h-20 w-auto" />
        )
      ) : null}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-[color:var(--tenant-primary)] sm:text-5xl">{title}</h1>
        {subtitle ? <p className="mx-auto max-w-2xl text-lg text-center text-[color:var(--tenant-primary)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap justify-center gap-3 sm:justify-start">{actions}</div> : null}
    </section>
  );
}


