import { apiClient } from "./api-client.js";

export interface Attendance {
  id: string;
  hotelId: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateAttendanceInput {
  employeeId: string;
  clockIn?: string;
  notes?: string;
  hotelId?: string;
}

export function listAttendance(): Promise<Attendance[]> {
  return apiClient.get<Attendance[]>("/attendances");
}

// create/clockOut n'appellent plus apiClient directement — voir hooks/use-attendance.ts, qui
// passe désormais par offline/mutation-queue.ts (queueOrSend) pour le support hors ligne, Étape 6.
