import { apiClient } from "./api-client.js";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  organizationId: string;
  hotelId: string | null;
  createdAt: string;
}

export function listUsers(): Promise<User[]> {
  return apiClient.get<User[]>("/users");
}
