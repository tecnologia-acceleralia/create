import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageContainer, PageHeader } from '@/components/common';
import { cn } from '@/utils/cn';
import { useSuperAdminSession } from '@/context/SuperAdminContext';

type SuperAdminLayoutProps = {
  readonly children: ReactNode;
};

const NAV_ITEMS: Array<{ to: string; key: 'dashboard' | 'tenants' | 'users' }> = [
  { to: '/superadmin', key: 'dashboard' },
  { to: '/superadmin/tenants', key: 'tenants' },
  { to: '/superadmin/users', key: 'users' }
];

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { t } = useTranslation();
  const { user } = useSuperAdminSession();
  const location = useLocation();

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email;
  const subtitle = displayName ? t('superadmin.welcome', { name: displayName }) : undefined;

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('superadmin.title')} subtitle={subtitle} />

      <nav className="flex flex-wrap gap-2 border-b border-border/70 pb-3">
        {NAV_ITEMS.map(item => {
          const isActive =
            item.key === 'dashboard'
              ? location.pathname === item.to || location.pathname === `${item.to}/`
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.key}
              to={item.to}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {t(`superadmin.nav.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-6">{children}</div>
    </PageContainer>
  );
}

