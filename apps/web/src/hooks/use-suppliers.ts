import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as suppliersService from "../services/suppliers.js";
import type { CreateSupplierInput, UpdateSupplierInput } from "../services/suppliers.js";

const SUPPLIERS_KEY = ["suppliers"] as const;

export function useSuppliers() {
  return useQuery({
    queryKey: SUPPLIERS_KEY,
    queryFn: suppliersService.listSuppliers,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplierInput) => suppliersService.createSupplier(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSupplierInput }) =>
      suppliersService.updateSupplier(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}
