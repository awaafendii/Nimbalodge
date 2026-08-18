import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queueOrSend, type QueueOrSendResult } from "../offline/mutation-queue.js";
import * as maintenanceInterventionsService from "../services/maintenance-interventions.js";
import type { CreateMaintenanceInterventionInput, MaintenanceIntervention } from "../services/maintenance-interventions.js";

const MAINTENANCE_INTERVENTIONS_KEY = ["maintenance-interventions"] as const;

export function useMaintenanceInterventions() {
  return useQuery({
    queryKey: MAINTENANCE_INTERVENTIONS_KEY,
    queryFn: maintenanceInterventionsService.listMaintenanceInterventions,
  });
}

export function useCreateMaintenanceIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceInterventionInput): Promise<QueueOrSendResult<MaintenanceIntervention>> =>
      queueOrSend({
        domain: "maintenance-interventions",
        type: "create",
        method: "POST",
        path: "/maintenance-interventions",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_INTERVENTIONS_KEY }),
  });
}

function useMaintenanceInterventionTransition(type: string, path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<QueueOrSendResult<MaintenanceIntervention>> =>
      queueOrSend({ domain: "maintenance-interventions", type, method: "POST", path: path(id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_INTERVENTIONS_KEY }),
  });
}

export function useStartMaintenanceIntervention() {
  return useMaintenanceInterventionTransition("start", (id) => `/maintenance-interventions/${id}/start`);
}

export function useCompleteMaintenanceIntervention() {
  return useMaintenanceInterventionTransition("complete", (id) => `/maintenance-interventions/${id}/complete`);
}

export function useCancelMaintenanceIntervention() {
  return useMaintenanceInterventionTransition("cancel", (id) => `/maintenance-interventions/${id}/cancel`);
}
