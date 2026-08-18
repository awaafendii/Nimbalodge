import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queueOrSend, type QueueOrSendResult } from "../offline/mutation-queue.js";
import * as housekeepingService from "../services/housekeeping.js";
import type { CreateHousekeepingTaskInput } from "../services/housekeeping.js";

const HOUSEKEEPING_DASHBOARD_KEY = ["housekeeping", "dashboard"] as const;

export function useHousekeepingDashboard() {
  return useQuery({
    queryKey: HOUSEKEEPING_DASHBOARD_KEY,
    queryFn: housekeepingService.getHousekeepingDashboard,
  });
}

export function useCreateHousekeepingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHousekeepingTaskInput): Promise<QueueOrSendResult<unknown>> =>
      queueOrSend({ domain: "housekeeping", type: "create-task", method: "POST", path: "/housekeeping-tasks", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_DASHBOARD_KEY }),
  });
}

export function useCleanHousekeepingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<QueueOrSendResult<unknown>> =>
      queueOrSend({ domain: "housekeeping", type: "clean", method: "POST", path: `/housekeeping-tasks/${id}/clean` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_DASHBOARD_KEY }),
  });
}

export function useInspectHousekeepingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<QueueOrSendResult<unknown>> =>
      queueOrSend({ domain: "housekeeping", type: "inspect", method: "POST", path: `/housekeeping-tasks/${id}/inspect` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_DASHBOARD_KEY }),
  });
}
