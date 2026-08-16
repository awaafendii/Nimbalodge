import { useQuery } from "@tanstack/react-query";

import * as auditLogsService from "../services/audit-logs.js";
import type { AuditLogFilters } from "../services/audit-logs.js";

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditLogsService.listAuditLogs(filters),
  });
}
