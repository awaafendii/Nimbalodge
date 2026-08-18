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

// create/clean/inspect n'appellent plus apiClient directement — voir hooks/use-housekeeping.ts, qui
// passe désormais par offline/mutation-queue.ts (queueOrSend) pour le support hors ligne, Étape 6.
