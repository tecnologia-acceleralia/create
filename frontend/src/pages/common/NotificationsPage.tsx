import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Spinner, EmptyState } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { ResourceListCard } from '@/components/cards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { safeTranslate } from '@/utils/i18n-helpers';
import { formatDateTime } from '@/utils/date';
import { getNotifications, markNotificationRead, type Notification } from '@/services/notifications';

function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const queryClient = useQueryClient();
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
                <h3 className="font-medium">{notification.title}</h3>
                {!notification.is_read && (
                  <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(notification.id)}>
                    {safeTranslate(t, 'notifications.markRead')}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{notification.message}</p>
              <p className="text-xs text-muted-foreground">
                {notification.created_at 
                  ? formatDateTime(locale, notification.created_at)
                  : safeTranslate(t, 'notifications.dateNotAvailable', { defaultValue: 'Fecha no disponible' })}
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


