import { apiClient } from "./api-client.js";

export interface Room {
  id: string;
  hotelId: string;
  roomTypeId: string;
  number: string;
  floor: string | null;
  building: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateRoomInput {
  roomTypeId: string;
  number: string;
  floor?: string;
  building?: string;
  hotelId?: string;
}

export interface UpdateRoomInput {
  roomTypeId?: string;
  number?: string;
  floor?: string;
  building?: string;
  isActive?: boolean;
}

export function listRooms(): Promise<Room[]> {
  return apiClient.get<Room[]>("/rooms");
}

export function createRoom(input: CreateRoomInput): Promise<Room> {
  return apiClient.post<Room>("/rooms", input);
}

export function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  return apiClient.patch<Room>(`/rooms/${id}`, input);
}
