import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as stockMovementsService from "../services/stock-movements.js";
import type {
  CreateAdjustmentInput,
  CreateStockMovementInput,
  CreateTransferInput,
} from "../services/stock-movements.js";

const STOCK_MOVEMENTS_KEY = ["stock-movements"] as const;

export function useStockMovements() {
  return useQuery({
    queryKey: STOCK_MOVEMENTS_KEY,
    queryFn: stockMovementsService.listStockMovements,
  });
}

// Invalide aussi le cache "products/:id/stock" (toutes clés confondues) — un mouvement change le
// solde en entrepôt du produit concerné, quel que soit son type.
function useStockMutation<TInput>(mutationFn: (input: TInput) => Promise<stockMovementsService.StockMovement>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCreateStockMovement() {
  return useStockMutation((input: CreateStockMovementInput) => stockMovementsService.createStockMovement(input));
}

export function useCreateTransfer() {
  return useStockMutation((input: CreateTransferInput) => stockMovementsService.createTransfer(input));
}

export function useCreateAdjustment() {
  return useStockMutation((input: CreateAdjustmentInput) => stockMovementsService.createAdjustment(input));
}
