import type { ReactNode } from 'react';
import { PageContainer, PageHeader } from '@/components/common';
import { cn } from '@/utils/cn';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  containerClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function DashboardLayout({
  title,
  subtitle,
  actions,
  icon,
  children,
  containerClassName,
  headerClassName,
  contentClassName
}: DashboardLayoutProps) {
  return (
    <PageContainer className={cn('space-y-6', containerClassName)}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        icon={icon}
        className={headerClassName}
      />
      <div className={cn('space-y-6', contentClassName)}>{children}</div>
    </PageContainer>
  );
}


