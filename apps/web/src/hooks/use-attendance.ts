import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as attendanceService from "../services/attendance.js";
import type { CreateAttendanceInput } from "../services/attendance.js";

const ATTENDANCE_KEY = ["attendances"] as const;

export function useAttendance() {
  return useQuery({
    queryKey: ATTENDANCE_KEY,
    queryFn: attendanceService.listAttendance,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceInput) => attendanceService.createAttendance(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY }),
  });
}

export function useClockOutAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceService.clockOutAttendance(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY }),
  });
}
