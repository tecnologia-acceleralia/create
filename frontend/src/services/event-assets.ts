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
  s3_key?: string;
  description?: string | null; // Texto descriptivo del recurso
  exists?: boolean; // Estado de validación (si existe en S3)
};

export async function getEventAssets(eventId: number): Promise<EventAsset[]> {
  const response = await apiClient.get(`/events/${eventId}/assets`);
  return response.data.data as EventAsset[];
}

export async function uploadEventAsset(eventId: number, file: File, name: string, overwrite = false, description?: string): Promise<EventAsset> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  if (overwrite) {
    formData.append('overwrite', 'true');
  }
  if (description) {
    formData.append('description', description);
  }

  const response = await apiClient.post(`/events/${eventId}/assets`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data.data as EventAsset;
}

export type AssetValidationResult = {
  id: number;
  name: string;
  s3_key: string;
  url?: string;
  checkedKey?: string;
  exists: boolean;
};

export async function validateEventAssets(eventId: number): Promise<AssetValidationResult[]> {
  const response = await apiClient.get(`/events/${eventId}/assets/validate`);
  return response.data.data as AssetValidationResult[];
}

export type InvalidMarker = {
  type: 'phase' | 'task' | 'event';
  id: number;
  name?: string;
  title?: string;
  phaseId?: number;
  phaseName?: string;
  marker: string;
  assetName: string;
};

export type CheckMarkersResult = {
  invalidMarkers: InvalidMarker[];
  totalInvalid: number;
  totalAssets: number;
};

export async function checkMarkers(eventId: number): Promise<CheckMarkersResult> {
  const response = await apiClient.get(`/events/${eventId}/assets/check-markers`);
  return response.data.data as CheckMarkersResult;
}

export async function updateEventAsset(eventId: number, assetId: number, data: { name?: string; description?: string | null }): Promise<EventAsset> {
  const response = await apiClient.put(`/events/${eventId}/assets/${assetId}`, data);
  return response.data.data as EventAsset;
}

export async function deleteEventAsset(eventId: number, assetId: number): Promise<void> {
  await apiClient.delete(`/events/${eventId}/assets/${assetId}`);
}

