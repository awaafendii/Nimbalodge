import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as departmentsService from "../services/departments.js";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "../services/departments.js";

const DEPARTMENTS_KEY = ["departments"] as const;

export function useDepartments() {
  return useQuery({
    queryKey: DEPARTMENTS_KEY,
    queryFn: departmentsService.listDepartments,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => departmentsService.createDepartment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      departmentsService.updateDepartment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  });
}
