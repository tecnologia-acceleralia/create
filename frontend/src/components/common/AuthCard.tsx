import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/common';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';

type AuthCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: 'md' | 'xl';
  className?: string;
  footer?: ReactNode;
  badge?: ReactNode;
};

export function AuthCard({
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className,
  footer,
  badge
}: AuthCardProps) {
  const { t } = useTranslation();
  const { branding, tenantSlug } = useTenant();

  return (
    <PageContainer className="flex justify-center">
      <Card
        className={cn(
          'h-full w-full border-border/70 shadow-lg shadow-[color:var(--tenant-primary)]/10',
          maxWidth === 'xl' ? 'max-w-xl' : 'max-w-md',
          className
        )}
      >
        <CardHeader className="flex flex-col items-center gap-3">
          {branding.logoUrl ? (
            <div
              className="flex h-12 w-auto items-center justify-center rounded border border-border p-2"
              style={{ backgroundColor: branding.primaryColor || '#0ea5e9' }}
            >
              <img
                src={branding.logoUrl}
                alt={safeTranslate(t, 'navigation.brand', { defaultValue: 'Create' })}
                className="h-full w-auto max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}
          {tenantSlug ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {safeTranslate(t, 'auth.loginForTenant', { tenant: tenantSlug })}
            </p>
          ) : null}
          {title ? (
            <CardTitle className="text-2xl font-semibold text-[color:var(--tenant-primary)]">
              {title}
            </CardTitle>
          ) : null}
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          {badge ? (
            <div className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              {badge}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {children}
          {footer ? <div className="mt-6 flex flex-col gap-2 text-center">{footer}</div> : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

