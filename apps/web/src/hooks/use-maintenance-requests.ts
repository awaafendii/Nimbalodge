import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as maintenanceRequestsService from "../services/maintenance-requests.js";
import type { CreateMaintenanceRequestInput } from "../services/maintenance-requests.js";

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
    mutationFn: (input: CreateMaintenanceRequestInput) => maintenanceRequestsService.createMaintenanceRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_REQUESTS_KEY }),
  });
}

function useMaintenanceRequestTransition(
  action: (id: string) => Promise<maintenanceRequestsService.MaintenanceRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_REQUESTS_KEY }),
  });
}

export function useApproveMaintenanceRequest() {
  return useMaintenanceRequestTransition((id) => maintenanceRequestsService.approveMaintenanceRequest(id));
}

export function useRejectMaintenanceRequest() {
  return useMaintenanceRequestTransition((id) => maintenanceRequestsService.rejectMaintenanceRequest(id));
}

export function useCancelMaintenanceRequest() {
  return useMaintenanceRequestTransition((id) => maintenanceRequestsService.cancelMaintenanceRequest(id));
}
