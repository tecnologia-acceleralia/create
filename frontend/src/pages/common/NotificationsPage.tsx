import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getNotifications, markNotificationRead, type Notification } from '@/services/notifications';

function NotificationsPage() {
  const { t } = useTranslation();
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
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('notifications.title')} />
      <div className="space-y-3">
        {notifications?.length ? notifications.map(notification => (
          <Card key={notification.id} className={notification.is_read ? 'opacity-70' : ''}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{notification.title}</h3>
                {!notification.is_read ? (
                  <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(notification.id)}>
                    {t('notifications.markRead')}
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{notification.message}</p>
              <p className="text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        )) : <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>}
      </div>
    </div>
  );
}

export default NotificationsPage;


