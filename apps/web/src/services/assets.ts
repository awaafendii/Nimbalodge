import { apiClient } from "./api-client.js";

export interface Asset {
  id: string;
  hotelId: string;
  name: string;
  roomId: string | null;
  category: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAssetInput {
  name: string;
  roomId?: string;
  category?: string;
  serialNumber?: string;
  purchaseDate?: string;
  notes?: string;
  hotelId?: string;
}

export interface UpdateAssetInput {
  name?: string;
  roomId?: string;
  category?: string;
  serialNumber?: string;
  notes?: string;
  isActive?: boolean;
}

export function listAssets(): Promise<Asset[]> {
  return apiClient.get<Asset[]>("/assets");
}

export function createAsset(input: CreateAssetInput): Promise<Asset> {
  return apiClient.post<Asset>("/assets", input);
}

export function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset> {
  return apiClient.patch<Asset>(`/assets/${id}`, input);
}
