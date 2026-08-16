import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as employeesService from "../services/employees.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../services/employees.js";

const EMPLOYEES_KEY = ["employees"] as const;

export function useEmployees() {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: employeesService.listEmployees,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesService.createEmployee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEmployeeInput }) =>
      employeesService.updateEmployee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}
