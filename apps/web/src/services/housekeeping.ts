import { apiClient } from "./api-client.js";

export type RoomHousekeepingStatus = "AVAILABLE" | "TO_CLEAN" | "CLEANED" | "INSPECTED";

export interface RoomHousekeepingStatusEntry {
  roomId: string;
  roomNumber: string;
  status: RoomHousekeepingStatus;
  taskId: string | null;
}

export interface CreateHousekeepingTaskInput {
  roomId: string;
  notes?: string;
  hotelId?: string;
}

export function getHousekeepingDashboard(): Promise<RoomHousekeepingStatusEntry[]> {
  return apiClient.get<RoomHousekeepingStatusEntry[]>("/housekeeping-tasks/dashboard");
}

export function createHousekeepingTask(input: CreateHousekeepingTaskInput) {
  return apiClient.post("/housekeeping-tasks", input);
}

export function cleanHousekeepingTask(id: string) {
  return apiClient.post(`/housekeeping-tasks/${id}/clean`);
}

export function inspectHousekeepingTask(id: string) {
  return apiClient.post(`/housekeeping-tasks/${id}/inspect`);
}
