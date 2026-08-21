import { apiClient } from "./api-client.js";

export interface UserHotelMembership {
  hotelId: string;
  hotelName: string;
  roleId: string;
  roleName: string;
  status: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  organizationId: string;
  hotelId: string | null;
  createdAt: string;
  hotelMemberships: UserHotelMembership[];
}

export function listUsers(): Promise<User[]> {
  return apiClient.get<User[]>("/users");
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  hotelId?: string;
  roleId: string;
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiClient.post<User>("/users", input);
}

export function addHotelMembership(userId: string, hotelId: string, roleId: string): Promise<User> {
  return apiClient.post<User>(`/users/${userId}/hotel-memberships`, { hotelId, roleId });
}

export function removeHotelMembership(userId: string, hotelId: string): Promise<User> {
  return apiClient.delete<User>(`/users/${userId}/hotel-memberships/${hotelId}`);
}
