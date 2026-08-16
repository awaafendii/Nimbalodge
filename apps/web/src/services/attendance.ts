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

export function createAttendance(input: CreateAttendanceInput): Promise<Attendance> {
  return apiClient.post<Attendance>("/attendances", input);
}

export function clockOutAttendance(id: string): Promise<Attendance> {
  return apiClient.post<Attendance>(`/attendances/${id}/clock-out`);
}
