import axios from 'axios';

const SUPERADMIN_URL = import.meta.env.VITE_API_URL?.replace('/api', '/api/superadmin') ?? 'http://localhost:4000/api/superadmin';

export async function getTenantsSuperAdmin(token: string) {
  const response = await axios.get(`${SUPERADMIN_URL}/tenants`, {
    headers: { 'x-super-admin-token': token }
  });
  return response.data.data as Array<{ id: number; slug: string; name: string; status: string; plan_type: string }>;
}

export async function createTenantSuperAdmin(token: string, payload: { slug: string; name: string; plan_type?: string; admin: { email: string; first_name?: string; last_name?: string } }) {
  const response = await axios.post(`${SUPERADMIN_URL}/tenants`, payload, {
    headers: { 'x-super-admin-token': token }
  });
  return response.data.data;
}


