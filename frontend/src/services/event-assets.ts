import { apiClient } from './api';

export type EventAsset = {
  id: number;
  name: string;
  original_filename: string;
  url: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  created_at: string;
  updated_at: string;
};

export async function getEventAssets(eventId: number): Promise<EventAsset[]> {
  const response = await apiClient.get(`/events/${eventId}/assets`);
  return response.data.data as EventAsset[];
}

export async function uploadEventAsset(eventId: number, file: File, name: string): Promise<EventAsset> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);

  const response = await apiClient.post(`/events/${eventId}/assets`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data.data as EventAsset;
}

export async function deleteEventAsset(eventId: number, assetId: number): Promise<void> {
  await apiClient.delete(`/events/${eventId}/assets/${assetId}`);
}

