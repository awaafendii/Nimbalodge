import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as warehousesService from "../services/warehouses.js";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "../services/warehouses.js";

const WAREHOUSES_KEY = ["warehouses"] as const;

export function useWarehouses() {
  return useQuery({
    queryKey: WAREHOUSES_KEY,
    queryFn: warehousesService.listWarehouses,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) => warehousesService.createWarehouse(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEY }),
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWarehouseInput }) =>
      warehousesService.updateWarehouse(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEY }),
  });
}
