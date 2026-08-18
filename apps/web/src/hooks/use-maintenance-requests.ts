import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queueOrSend, type QueueOrSendResult } from "../offline/mutation-queue.js";
import * as maintenanceRequestsService from "../services/maintenance-requests.js";
import type { CreateMaintenanceRequestInput, MaintenanceRequest } from "../services/maintenance-requests.js";

const MAINTENANCE_REQUESTS_KEY = ["maintenance-requests"] as const;

export function useMaintenanceRequests() {
  return useQuery({
    queryKey: MAINTENANCE_REQUESTS_KEY,
    queryFn: maintenanceRequestsService.listMaintenanceRequests,
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceRequestInput): Promise<QueueOrSendResult<MaintenanceRequest>> =>
      queueOrSend({ domain: "maintenance-requests", type: "create", method: "POST", path: "/maintenance-requests", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_REQUESTS_KEY }),
  });
}

function useMaintenanceRequestTransition(type: string, path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<QueueOrSendResult<MaintenanceRequest>> =>
      queueOrSend({ domain: "maintenance-requests", type, method: "POST", path: path(id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_REQUESTS_KEY }),
  });
}

export function useApproveMaintenanceRequest() {
  return useMaintenanceRequestTransition("approve", (id) => `/maintenance-requests/${id}/approve`);
}

export function useRejectMaintenanceRequest() {
  return useMaintenanceRequestTransition("reject", (id) => `/maintenance-requests/${id}/reject`);
}

export function useCancelMaintenanceRequest() {
  return useMaintenanceRequestTransition("cancel", (id) => `/maintenance-requests/${id}/cancel`);
}
