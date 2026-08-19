import { keepPreviousData, useQuery } from "@tanstack/react-query";

import * as auditLogsService from "../services/audit-logs.js";
import type { AuditLogFilters } from "../services/audit-logs.js";

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditLogsService.listAuditLogs(filters),
    // Chaque frappe dans la recherche serveur (ou changement de filtre/page) change la queryKey —
    // sans ceci, isLoading repasserait à true à chaque frappe, démontant DataTable (donc son champ
    // de recherche) le temps du round-trip et perdant le focus/les caractères déjà saisis. Garde
    // l'ancienne page affichée (isFetching seul reste vrai) jusqu'à ce que la nouvelle arrive.
    placeholderData: keepPreviousData,
  });
}

export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: ["audit-logs", "detail", id],
    queryFn: () => auditLogsService.getAuditLog(id as string),
    enabled: id !== null,
  });
}
