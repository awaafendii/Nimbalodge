import { apiClient } from "./api-client.js";

export interface Guest {
  id: string;
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  address: string | null;
  preferences: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateGuestInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  address?: string;
  preferences?: string;
  notes?: string;
  hotelId?: string;
}

export interface UpdateGuestInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  address?: string;
  preferences?: string;
  notes?: string;
  isActive?: boolean;
}

export function listGuests(): Promise<Guest[]> {
  return apiClient.get<Guest[]>("/guests");
}

export function createGuest(input: CreateGuestInput): Promise<Guest> {
  return apiClient.post<Guest>("/guests", input);
}

export function updateGuest(id: string, input: UpdateGuestInput): Promise<Guest> {
  return apiClient.patch<Guest>(`/guests/${id}`, input);
}
