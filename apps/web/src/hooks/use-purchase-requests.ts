import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as purchaseRequestsService from "../services/purchase-requests.js";
import type { CreatePurchaseRequestInput } from "../services/purchase-requests.js";

const PURCHASE_REQUESTS_KEY = ["purchase-requests"] as const;

export function usePurchaseRequests() {
  return useQuery({
    queryKey: PURCHASE_REQUESTS_KEY,
    queryFn: purchaseRequestsService.listPurchaseRequests,
  });
}

export function useCreatePurchaseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseRequestInput) => purchaseRequestsService.createPurchaseRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_REQUESTS_KEY }),
  });
}

function usePurchaseRequestTransition(
  action: (id: string) => Promise<purchaseRequestsService.PurchaseRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_REQUESTS_KEY }),
  });
}

export function useApprovePurchaseRequest() {
  return usePurchaseRequestTransition((id) => purchaseRequestsService.approvePurchaseRequest(id));
}

export function useRejectPurchaseRequest() {
  return usePurchaseRequestTransition((id) => purchaseRequestsService.rejectPurchaseRequest(id));
}

export function useCancelPurchaseRequest() {
  return usePurchaseRequestTransition((id) => purchaseRequestsService.cancelPurchaseRequest(id));
}
