import { apiClient } from "./api-client.js";

export interface Hotel {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  category: string | null;
  timezone: string | null;
  languages: string[];
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export function listHotels(): Promise<Hotel[]> {
  return apiClient.get<Hotel[]>("/hotels");
}

export function getHotel(id: string): Promise<Hotel> {
  return apiClient.get<Hotel>(`/hotels/${id}`);
}
