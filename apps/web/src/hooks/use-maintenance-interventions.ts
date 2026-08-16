import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as maintenanceInterventionsService from "../services/maintenance-interventions.js";
import type { CreateMaintenanceInterventionInput } from "../services/maintenance-interventions.js";

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
    mutationFn: (input: CreateMaintenanceInterventionInput) =>
      maintenanceInterventionsService.createMaintenanceIntervention(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_INTERVENTIONS_KEY }),
  });
}

function useMaintenanceInterventionTransition(
  action: (id: string) => Promise<maintenanceInterventionsService.MaintenanceIntervention>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAINTENANCE_INTERVENTIONS_KEY }),
  });
}

export function useStartMaintenanceIntervention() {
  return useMaintenanceInterventionTransition((id) => maintenanceInterventionsService.startMaintenanceIntervention(id));
}

export function useCompleteMaintenanceIntervention() {
  return useMaintenanceInterventionTransition((id) =>
    maintenanceInterventionsService.completeMaintenanceIntervention(id)
  );
}

export function useCancelMaintenanceIntervention() {
  return useMaintenanceInterventionTransition((id) =>
    maintenanceInterventionsService.cancelMaintenanceIntervention(id)
  );
}
