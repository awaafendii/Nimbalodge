import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as leaveRequestsService from "../services/leave-requests.js";
import type { CreateLeaveRequestInput } from "../services/leave-requests.js";

const LEAVE_REQUESTS_KEY = ["leave-requests"] as const;

export function useLeaveRequests() {
  return useQuery({
    queryKey: LEAVE_REQUESTS_KEY,
    queryFn: leaveRequestsService.listLeaveRequests,
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => leaveRequestsService.createLeaveRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY }),
  });
}

function useLeaveRequestTransition(action: (id: string) => Promise<leaveRequestsService.LeaveRequest>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY }),
  });
}

export function useApproveLeaveRequest() {
  return useLeaveRequestTransition((id) => leaveRequestsService.approveLeaveRequest(id));
}

export function useRejectLeaveRequest() {
  return useLeaveRequestTransition((id) => leaveRequestsService.rejectLeaveRequest(id));
}

export function useCancelLeaveRequest() {
  return useLeaveRequestTransition((id) => leaveRequestsService.cancelLeaveRequest(id));
}
