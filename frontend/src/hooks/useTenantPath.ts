import { useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';

function normalizePath(target: string) {
  if (!target || target === '/') {
    return '';
  }
  return target.startsWith('/') ? target : `/${target}`;
}

export function useTenantPath() {
  const { tenantSlug } = useTenant();

  return useMemo(() => {
    return (target = ''): string => {
      const normalized = normalizePath(target);

      if (!tenantSlug) {
        return normalized || '/';
      }

      return `/tenant/${tenantSlug}${normalized}`;
    };
  }, [tenantSlug]);
}


