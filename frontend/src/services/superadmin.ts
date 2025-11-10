import axios from 'axios';

const DEFAULT_SUPERADMIN_URL = '/api';

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveSuperAdminBaseUrl() {
  const explicit = import.meta.env.VITE_SUPERADMIN_API_URL;
  if (explicit) {
    return normalizeUrl(explicit);
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    return DEFAULT_SUPERADMIN_URL;
  }

  try {
    const url = new URL(apiUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const apiIndex = segments.indexOf('api');

    if (apiIndex === -1) {
      segments.push('api', 'superadmin');
    } else {
      segments.splice(apiIndex + 1, segments.length - (apiIndex + 1), 'superadmin');
    }

    url.pathname = `/${segments.join('/')}`;
    return normalizeUrl(url.toString());
  } catch {
    const trimmed = normalizeUrl(apiUrl);

    if (trimmed.includes('/api/v1')) {
      return normalizeUrl(trimmed.replace('/api/v1', '/api/superadmin'));
    }

    if (trimmed.endsWith('/api')) {
      return `${trimmed}/superadmin`;
    }

    if (trimmed.includes('/api')) {
      return normalizeUrl(trimmed.replace('/api', '/api/superadmin'));
    }

    return `${trimmed}/api/superadmin`;
  }
}

const SUPERADMIN_URL = resolveSuperAdminBaseUrl();

const superAdminClient = axios.create({
  baseURL: SUPERADMIN_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let currentToken: string | null = null;

superAdminClient.interceptors.request.use(config => {
  if (currentToken) {
    if (typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${currentToken}`);
    } else {
      // Fallback for Axios < 1.3 without AxiosHeaders helper
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
  }
  return config;
});

export function setSuperAdminAuthToken(token: string | null) {
  currentToken = token;
}

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type SuperAdminTenant = {
  id: number;
  slug: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  plan_type: 'free' | 'basic' | 'professional' | 'enterprise';
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  max_evaluators: number | null;
  max_participants: number | null;
  max_appointments_per_month: number | null;
  start_date: string;
  end_date: string;
  hero_content?: unknown;
  tenant_css: string | null;
  created_at: string;
  updated_at: string;
  user_count: number;
};

export type SuperAdminTenantFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string[];
  plan?: string[];
  sortField?: 'name' | 'slug' | 'plan' | 'plan_type' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type TenantsListResponse = {
  items: SuperAdminTenant[];
  meta: PaginationMeta;
  appliedFilters: {
    search: string;
    status: string[];
    plan: string[];
  };
  sort: {
    field: string;
    order: 'asc' | 'desc';
  };
};

type CreateTenantPayload = {
  slug: string;
  name: string;
  subdomain?: string | null;
  custom_domain?: string | null;
  plan_type?: SuperAdminTenant['plan_type'];
  status?: SuperAdminTenant['status'];
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  max_evaluators?: number | null;
  max_participants?: number | null;
  max_appointments_per_month?: number | null;
  hero_content?: unknown;
  tenant_css?: string | null;
  admin: {
    email: string;
    first_name?: string;
    last_name?: string;
    language?: string;
    password?: string;
    profile_image_url?: string | null;
  };
};

type UpdateTenantPayload = Partial<
  Pick<
    SuperAdminTenant,
    | 'name'
    | 'plan_type'
    | 'status'
    | 'primary_color'
    | 'secondary_color'
    | 'accent_color'
    | 'custom_domain'
    | 'subdomain'
    | 'website_url'
    | 'facebook_url'
    | 'instagram_url'
    | 'linkedin_url'
    | 'twitter_url'
    | 'youtube_url'
    | 'max_evaluators'
    | 'max_participants'
    | 'max_appointments_per_month'
    | 'tenant_css'
    | 'start_date'
    | 'end_date'
  >
> & {
  hero_content?: unknown;
  logo?: string | null;
  logo_url?: string | null;
};

type SuperAdminLoginResponse = {
  tokens: {
    token: string;
    refreshToken: string;
  };
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    profile_image_url: string | null;
    is_super_admin: boolean;
  };
};

export async function superAdminLogin(payload: { email: string; password: string }) {
  const response = await superAdminClient.post<ApiResponse<SuperAdminLoginResponse>>('/login', payload, {
    headers: { Authorization: undefined }
  });
  return response.data.data;
}

export async function getSuperAdminOverview() {
  const response = await superAdminClient.get<ApiResponse<{
    tenants: { total: number; active: number; byStatus: Record<string, number> };
    users: { total: number; byStatus: Record<string, number> };
  }>>('/overview');
  return response.data.data;
}

function normalizeTenantFilters(filters?: SuperAdminTenantFilters) {
  if (!filters) {
    return undefined;
  }

  return {
    ...filters,
    status: filters.status?.length ? filters.status.join(',') : undefined,
    plan: filters.plan?.length ? filters.plan.join(',') : undefined
  };
}

export async function listSuperAdminTenants(filters?: SuperAdminTenantFilters) {
  const response = await superAdminClient.get<ApiResponse<TenantsListResponse>>('/tenants', {
    params: normalizeTenantFilters(filters)
  });
  return response.data.data;
}

export async function createTenantSuperAdmin(payload: CreateTenantPayload) {
  const response = await superAdminClient.post<ApiResponse<{ tenant: SuperAdminTenant; admin: unknown }>>(
    '/tenants',
    payload
  );
  return response.data.data;
}

export async function updateTenantSuperAdmin(tenantId: number, payload: UpdateTenantPayload) {
  const response = await superAdminClient.patch<ApiResponse<SuperAdminTenant>>(`/tenants/${tenantId}`, payload);
  return response.data.data;
}

export async function deleteTenantSuperAdmin(tenantId: number) {
  await superAdminClient.delete(`/tenants/${tenantId}`);
}

export type SuperAdminUserTenantMembership = {
  id: number;
  status: 'active' | 'inactive' | 'invited';
  tenant: {
    id: number;
    name: string;
    slug: string;
    status: SuperAdminTenant['status'];
    plan_type: SuperAdminTenant['plan_type'];
  } | null;
};

export type SuperAdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  status: 'active' | 'inactive' | 'invited';
  is_super_admin: boolean;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
  tenantMemberships: SuperAdminUserTenantMembership[];
};

export type SuperAdminUserFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string[];
  tenantId?: number;
  isSuperAdmin?: boolean;
  sortField?: 'email' | 'first_name' | 'last_name' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type UsersListResponse = {
  items: SuperAdminUser[];
  meta: PaginationMeta;
  appliedFilters: {
    search: string;
    status: string[];
    tenantId?: number;
    isSuperAdmin?: boolean;
  };
  sort: {
    field: string;
    order: 'asc' | 'desc';
  };
};

function normalizeUserFilters(filters?: SuperAdminUserFilters) {
  if (!filters) {
    return undefined;
  }

  return {
    ...filters,
    status: filters.status?.length ? filters.status.join(',') : undefined,
    isSuperAdmin:
      typeof filters.isSuperAdmin === 'boolean' ? String(filters.isSuperAdmin) : undefined
  };
}

export async function listSuperAdminUsers(filters?: SuperAdminUserFilters) {
  const response = await superAdminClient.get<ApiResponse<UsersListResponse>>('/users', {
    params: normalizeUserFilters(filters)
  });
  return response.data.data;
}

type CreateSuperAdminUserPayload = {
  email: string;
  first_name: string;
  last_name: string;
  language?: string;
  status?: SuperAdminUser['status'];
  is_super_admin?: boolean;
  password?: string;
  profile_image_url?: string | null;
  tenantIds?: number[];
};

export async function createSuperAdminUser(payload: CreateSuperAdminUserPayload) {
  const response = await superAdminClient.post<
    ApiResponse<{ user: SuperAdminUser; provisionalPassword: string | null }>
  >('/users', payload);
  return response.data.data;
}

type UpdateSuperAdminUserPayload = Partial<Omit<CreateSuperAdminUserPayload, 'email'>> & {
  email?: string;
};

export async function updateSuperAdminUser(userId: number, payload: UpdateSuperAdminUserPayload) {
  const response = await superAdminClient.patch<ApiResponse<SuperAdminUser>>(`/users/${userId}`, payload);
  return response.data.data;
}

export async function deleteSuperAdminUser(userId: number) {
  await superAdminClient.delete(`/users/${userId}`);
}

export type HealthcheckStatus = {
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
};

export async function runSuperAdminHealthcheck() {
  const response = await superAdminClient.get<ApiResponse<{
    mailersend: HealthcheckStatus;
    openai: HealthcheckStatus;
    spaces: HealthcheckStatus;
  }>>('/healthcheck');
  return response.data.data;
}

export async function testSuperAdminService(
  service: 'mailersend' | 'openai' | 'spaces'
) {
  const response = await superAdminClient.post<
    ApiResponse<{ service: typeof service; status: HealthcheckStatus }>
  >(`/healthcheck/${service}/test`);

  return response.data.data;
}