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

export interface CreateHotelInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  // Case à cocher explicite, non cochée par défaut — jamais un comportement caché (voir
  // HotelsService.create(), §48 du brief : "un choix proposé à la création, pas imposé").
  createDefaultDepartment?: boolean;
}

export function createHotel(input: CreateHotelInput): Promise<Hotel> {
  return apiClient.post<Hotel>("/hotels", input);
}
