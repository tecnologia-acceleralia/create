import { apiClient } from './api';

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: 'system' | 'evaluation' | 'reminder';
  is_read: boolean;
  created_at: string;
};

export async function getNotifications() {
  const response = await apiClient.get('/notifications');
  return response.data.data as Notification[];
}

export async function markNotificationRead(notificationId: number) {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

