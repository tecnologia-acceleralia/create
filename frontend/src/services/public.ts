import axios from 'axios';

const PUBLIC_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '/api/public') ?? 'http://localhost:5100/api/public';

export async function getPublicBranding(slug: string) {
  const response = await axios.get(`${PUBLIC_BASE_URL}/branding`, { params: { slug } });
  return response.data;
}

export async function getPublicEvents(slug: string) {
  const response = await axios.get(`${PUBLIC_BASE_URL}/events`, { params: { slug } });
  return response.data.data as Array<{
    id: number;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    video_url?: string | null;
    allow_open_registration: boolean;
  }>;
}

export async function getAllPublicEvents() {
  const response = await axios.get(`${PUBLIC_BASE_URL}/events/all`);
  return response.data.data as Array<{
    id: number;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    video_url?: string | null;
    allow_open_registration: boolean;
    tenant: {
      id: number;
      name: string;
      slug: string;
      logo_url: string | null;
      primary_color: string | null;
      secondary_color: string | null;
    } | null;
  }>;
}


