import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as purchaseOrdersService from "../services/purchase-orders.js";
import type { CreateGoodsReceiptInput, CreatePurchaseOrderInput } from "../services/purchase-orders.js";

const PURCHASE_ORDERS_KEY = ["purchase-orders"] as const;

export function usePurchaseOrders() {
  return useQuery({
    queryKey: PURCHASE_ORDERS_KEY,
    queryFn: purchaseOrdersService.listPurchaseOrders,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => purchaseOrdersService.createPurchaseOrder(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY }),
  });
}

export function useSendPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersService.sendPurchaseOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY }),
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersService.cancelPurchaseOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY }),
  });
}

export function useCreateGoodsReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseOrderId, input }: { purchaseOrderId: string; input: CreateGoodsReceiptInput }) =>
      purchaseOrdersService.createGoodsReceipt(purchaseOrderId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY }),
  });
}
