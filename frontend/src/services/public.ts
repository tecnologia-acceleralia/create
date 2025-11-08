import axios from 'axios';

const PUBLIC_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '/api/public') ?? 'http://localhost:4000/api/public';

export async function getPublicBranding(slug: string) {
  const response = await axios.get(`${PUBLIC_BASE_URL}/tenant/branding`, { params: { slug } });
  return response.data.data as {
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
  };
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
  }>;
}


