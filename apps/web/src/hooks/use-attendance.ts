import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queueOrSend, type QueueOrSendResult } from "../offline/mutation-queue.js";
import * as attendanceService from "../services/attendance.js";
import type { Attendance, CreateAttendanceInput } from "../services/attendance.js";

const ATTENDANCE_KEY = ["attendances"] as const;

export function useAttendance() {
  return useQuery({
    queryKey: ATTENDANCE_KEY,
    queryFn: attendanceService.listAttendance,
  });
}

// Étape 6 (Offline) — domaine pilote : passe par queueOrSend plutôt qu'un appel direct à
// apiClient. Hors ligne (ou réseau instable), le pointage est mis en file avec l'horodatage RÉEL
// du moment de l'action (clockIn explicite) — jamais laissé au serveur l'estampiller à l'heure de
// synchronisation, potentiellement des heures plus tard (le DTO le supportait déjà, seule l'UI ne
// l'envoyait pas jusqu'ici).
export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceInput): Promise<QueueOrSendResult<Attendance>> =>
      queueOrSend<Attendance>({
        domain: "attendances",
        type: "clock-in",
        method: "POST",
        path: "/attendances",
        body: { ...input, clockIn: input.clockIn ?? new Date().toISOString() },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY }),
  });
}

export function useClockOutAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<QueueOrSendResult<Attendance>> =>
      queueOrSend<Attendance>({
        domain: "attendances",
        type: "clock-out",
        method: "POST",
        path: `/attendances/${id}/clock-out`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY }),
  });
}
