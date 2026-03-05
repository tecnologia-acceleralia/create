import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Spinner, EmptyState } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { ResourceListCard } from '@/components/cards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { safeTranslate } from '@/utils/i18n-helpers';
import { formatDate } from '@/utils/date';
import { getMultilingualText } from '@/utils/multilingual';
import { getNotifications, markNotificationRead, type Notification } from '@/services/notifications';

const LOCALE_TO_LANG = (locale: string): 'es' | 'ca' | 'en' =>
  locale.startsWith('ca') ? 'ca' : locale.startsWith('en') ? 'en' : 'es';

/** Mapa para notificaciones antiguas sin metadata: título en español -> claves i18n (así se muestran en el idioma del usuario). */
const LEGACY_TITLE_TO_KEYS: { title: string; titleKey: string; messageKey: string; hasPhase: boolean }[] = [
  { title: 'Nueva evaluación de fase asistida por IA', titleKey: 'notifications.newPhaseEvaluationAi', messageKey: 'notifications.phaseEvaluationAiReceived', hasPhase: true },
  { title: 'Nueva evaluación de fase', titleKey: 'notifications.newPhaseEvaluation', messageKey: 'notifications.phaseEvaluationReceived', hasPhase: true },
  { title: 'Nueva evaluación de proyecto asistida por IA', titleKey: 'notifications.newProjectEvaluationAi', messageKey: 'notifications.projectEvaluationAiReceived', hasPhase: false },
  { title: 'Nueva evaluación de proyecto', titleKey: 'notifications.newProjectEvaluation', messageKey: 'notifications.projectEvaluationReceived', hasPhase: false }
];

function getLegacyKeys(notification: Notification): { titleKey: string; messageKey: string; hasPhase: boolean } | null {
  const title = (notification.title ?? '').trim();
  for (const entry of LEGACY_TITLE_TO_KEYS) {
    if (title === entry.title) return { titleKey: entry.titleKey, messageKey: entry.messageKey, hasPhase: entry.hasPhase };
  }
  return null;
}

/** Corrige mensajes guardados con "[object Object]" por un texto legible. */
function sanitizeNotificationMessage(message: string | null | undefined, fallback: string): string {
  if (message == null) return '';
  return String(message).replace(/"\[object Object\]"/g, `"${fallback}"`);
}

function getNotificationTitle(notification: Notification, t: (key: string, opts?: object) => string): string {
  const meta = notification.metadata;
  if (meta?.title_key) return safeTranslate(t, meta.title_key, { defaultValue: notification.title });
  const legacy = getLegacyKeys(notification);
  if (legacy) return safeTranslate(t, legacy.titleKey, { defaultValue: notification.title });
  return notification.title ?? '';
}

function getNotificationMessage(notification: Notification, t: (key: string, opts?: object) => string, locale: string, phaseFallback: string): string {
  const meta = notification.metadata;
  if (meta?.message_key) {
    const lang = LOCALE_TO_LANG(locale);
    const phaseName = meta.phase_name ? getMultilingualText(meta.phase_name, lang) : undefined;
    return safeTranslate(t, meta.message_key, { phaseName: phaseName ?? phaseFallback, defaultValue: notification.message });
  }
  const legacy = getLegacyKeys(notification);
  if (legacy) {
    const phaseName = legacy.hasPhase ? phaseFallback : undefined;
    return safeTranslate(t, legacy.messageKey, { phaseName, defaultValue: notification.message ?? '' });
  }
  return sanitizeNotificationMessage(notification.message, phaseFallback);
}

function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const queryClient = useQueryClient();
  const phaseFallback = safeTranslate(t, 'notifications.phaseNameFallback', { defaultValue: 'la fase correspondiente' });
  const { data: notifications, isLoading } = useQuery<Notification[]>({ queryKey: ['notifications'], queryFn: getNotifications });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <DashboardLayout title={safeTranslate(t, 'notifications.title')}>
      <ResourceListCard
        title={safeTranslate(t, 'notifications.title')}
        items={notifications ?? []}
        renderItem={notification => (
          <Card key={notification.id} className={notification.is_read ? 'opacity-70' : ''}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{getNotificationTitle(notification, t)}</h3>
                {!notification.is_read && (
                  <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(notification.id)}>
                    {safeTranslate(t, 'notifications.markRead')}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{getNotificationMessage(notification, t, locale, phaseFallback)}</p>
              <p className="text-xs text-muted-foreground">
                {(notification.created_at && formatDate(locale, notification.created_at)) ??
                  safeTranslate(t, 'notifications.dateNotAvailable', { defaultValue: 'Fecha no disponible' })}
              </p>
            </CardContent>
          </Card>
        )}
        emptyMessage={<EmptyState message={safeTranslate(t, 'notifications.empty')} />}
        contentClassName="space-y-3"
      />
    </DashboardLayout>
  );
}

export default NotificationsPage;


