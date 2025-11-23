import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { safeTranslate } from '@/utils/i18n-helpers';
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
  onCleanEvent?: (eventId: number) => void | Promise<void>;
  isCleaningEvent?: boolean;
};

export function TenantTrackingModal({
  open,
  onOpenChange,
  tenant,
  trackingEventId,
  onTrackingEventIdChange,
  trackingEvents,
  isLoadingEvents,
  onSubmit,
  onCleanEvent,
  isCleaningEvent = false
}: TenantTrackingModalProps) {
  const { t } = useTranslation();
  const eventSelectRef = useRef<HTMLSelectElement>(null);
  const eventSelectContainerRef = useRef<HTMLDivElement>(null);
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);

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
          <DialogTitle>{safeTranslate(t, 'superadmin.tenants.trackingDialogTitle')}</DialogTitle>
          <DialogDescription>{safeTranslate(t, 'superadmin.tenants.trackingDialogDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-tenant-name">
              {safeTranslate(t, 'superadmin.tenants.trackingDialogTenantName')}
            </label>
            <Input id="tracking-tenant-name" value={tenant?.name ?? ''} disabled />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-tenant-slug">
              {safeTranslate(t, 'superadmin.tenants.trackingDialogTenantSlug')}
            </label>
            <Input id="tracking-tenant-slug" value={tenant?.slug ?? ''} disabled />
          </div>
          <div className="space-y-1" ref={eventSelectContainerRef}>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-event">
              {safeTranslate(t, 'superadmin.tenants.trackingDialogEvent')}
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
                  ? safeTranslate(t, 'common.loading')
                  : safeTranslate(t, 'superadmin.tenants.trackingDialogEventPlaceholder')}
              </option>
              {trackingEvents.map(eventOption => (
                <option key={eventOption.id} value={String(eventOption.id)}>
                  {eventOption.name}
                </option>
              ))}
            </Select>
            {isLoadingEvents ? (
              <p className="text-xs text-muted-foreground">{safeTranslate(t, 'superadmin.tenants.trackingDialogLoading')}</p>
            ) : null}
            {!isLoadingEvents && trackingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">{safeTranslate(t, 'superadmin.tenants.trackingDialogEmpty')}</p>
            ) : null}
          </div>
          <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {trackingEventId && onCleanEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowCleanConfirm(true)}
                  disabled={isCleaningEvent || isLoadingEvents}
                  className="w-full sm:w-auto"
                >
                  {safeTranslate(t, 'superadmin.tenants.cleanEvent')}
                </Button>
              )}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                {safeTranslate(t, 'common.cancel')}
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {safeTranslate(t, 'superadmin.tenants.trackingDialogSubmit')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={showCleanConfirm} onOpenChange={setShowCleanConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmWarning')}</p>
              <p className="font-medium">{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmDescription')}</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmTeams')}</li>
                <li>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmMembers')}</li>
                <li>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmSubmissions')}</li>
                <li>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmEvaluations')}</li>
                <li>{safeTranslate(t, 'superadmin.tenants.cleanEventConfirmNotifications')}</li>
              </ul>
              <p className="pt-2 font-semibold text-destructive">
                {safeTranslate(t, 'superadmin.tenants.cleanEventConfirmIrreversible')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaningEvent}>{safeTranslate(t, 'common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (onCleanEvent && trackingEventId) {
                  const eventId = Number.parseInt(trackingEventId, 10);
                  if (!Number.isNaN(eventId)) {
                    await onCleanEvent(eventId);
                    setShowCleanConfirm(false);
                    onOpenChange(false);
                  }
                }
              }}
              disabled={isCleaningEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCleaningEvent ? safeTranslate(t, 'common.processing') : safeTranslate(t, 'superadmin.tenants.cleanEventConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

