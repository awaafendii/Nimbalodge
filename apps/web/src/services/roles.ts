import { apiClient } from "./api-client.js";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  isSystem: boolean;
}

export function listRoles(): Promise<Role[]> {
  return apiClient.get<Role[]>("/roles");
}
