import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { SuperAdminTenant } from '@/services/superadmin';

type TrackingEventOption = {
  id: number;
  name: string;
};

type TenantTrackingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: SuperAdminTenant | null;
  trackingEventId: string;
  onTrackingEventIdChange: (eventId: string) => void;
  trackingEvents: TrackingEventOption[];
  isLoadingEvents: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function TenantTrackingModal({
  open,
  onOpenChange,
  tenant,
  trackingEventId,
  onTrackingEventIdChange,
  trackingEvents,
  isLoadingEvents,
  onSubmit
}: TenantTrackingModalProps) {
  const { t } = useTranslation();
  const eventSelectRef = useRef<HTMLSelectElement>(null);
  const eventSelectContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !isLoadingEvents && trackingEvents.length > 0) {
      // Pequeño delay para asegurar que el diálogo esté completamente renderizado
      const timer = setTimeout(() => {
        // Buscar el trigger del Select (elemento visible de Radix UI) dentro del contenedor
        if (eventSelectContainerRef.current) {
          const trigger = eventSelectContainerRef.current.querySelector<HTMLElement>(
            'button[data-radix-select-trigger], [role="combobox"]'
          );
          if (trigger) {
            trigger.focus();
          } else {
            // Fallback: buscar cualquier botón dentro del contenedor
            const fallbackTrigger = eventSelectContainerRef.current.querySelector<HTMLElement>('button');
            fallbackTrigger?.focus();
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, isLoadingEvents, trackingEvents.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('superadmin.tenants.trackingDialogTitle')}</DialogTitle>
          <DialogDescription>{t('superadmin.tenants.trackingDialogDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-tenant-name">
              {t('superadmin.tenants.trackingDialogTenantName')}
            </label>
            <Input id="tracking-tenant-name" value={tenant?.name ?? ''} disabled />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-tenant-slug">
              {t('superadmin.tenants.trackingDialogTenantSlug')}
            </label>
            <Input id="tracking-tenant-slug" value={tenant?.slug ?? ''} disabled />
          </div>
          <div className="space-y-1" ref={eventSelectContainerRef}>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-event">
              {t('superadmin.tenants.trackingDialogEvent')}
            </label>
            <Select
              ref={eventSelectRef}
              id="tracking-event"
              value={trackingEventId}
              onChange={event => onTrackingEventIdChange(event.target.value)}
              disabled={isLoadingEvents || trackingEvents.length === 0}
            >
              <option value="">
                {isLoadingEvents
                  ? t('common.loading')
                  : t('superadmin.tenants.trackingDialogEventPlaceholder')}
              </option>
              {trackingEvents.map(eventOption => (
                <option key={eventOption.id} value={String(eventOption.id)}>
                  {eventOption.name}
                </option>
              ))}
            </Select>
            {isLoadingEvents ? (
              <p className="text-xs text-muted-foreground">{t('superadmin.tenants.trackingDialogLoading')}</p>
            ) : null}
            {!isLoadingEvents && trackingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('superadmin.tenants.trackingDialogEmpty')}</p>
            ) : null}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('superadmin.tenants.trackingDialogSubmit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

