import { apiClient } from "./api-client.js";

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  code: string | null;
  description: string | null;
  baseRate: string;
  currency: string;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateRoomTypeInput {
  name: string;
  code?: string;
  description?: string;
  baseRate: number;
  currency?: string;
  capacity?: number;
  hotelId?: string;
}

export interface UpdateRoomTypeInput {
  name?: string;
  code?: string;
  description?: string;
  baseRate?: number;
  currency?: string;
  capacity?: number;
  isActive?: boolean;
}

export function listRoomTypes(): Promise<RoomType[]> {
  return apiClient.get<RoomType[]>("/room-types");
}

export function createRoomType(input: CreateRoomTypeInput): Promise<RoomType> {
  return apiClient.post<RoomType>("/room-types", input);
}

export function updateRoomType(id: string, input: UpdateRoomTypeInput): Promise<RoomType> {
  return apiClient.patch<RoomType>(`/room-types/${id}`, input);
}
