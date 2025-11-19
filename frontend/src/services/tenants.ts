import { apiClient } from './api';

export type TenantOverviewStatistics = {
  events: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  teams: number;
  projects: number;
  submissions: number;
  evaluations: number;
  users: number;
  registrations: number;
};

export type TenantEventSummary = {
  id: number;
  name: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  created_at?: string;
};

export type TenantOverview = {
  statistics: TenantOverviewStatistics;
  recentEvents: TenantEventSummary[];
  upcomingEvents: TenantEventSummary[];
};

export async function getTenantOverview(): Promise<TenantOverview> {
  const response = await apiClient.get('/tenants/overview');
  return response.data.data as TenantOverview;
}


