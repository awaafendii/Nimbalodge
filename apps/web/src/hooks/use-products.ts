import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as productsService from "../services/products.js";
import type { CreateProductInput, UpdateProductInput } from "../services/products.js";

const PRODUCTS_KEY = ["products"] as const;

export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: productsService.listProducts,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => productsService.createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      productsService.updateProduct(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

// Interrogé à la demande (par produit, sur ouverture du dialogue "Voir le stock") — jamais en
// masse sur la liste, qui n'expose que le catalogue statique (voir products.service.ts list()).
export function useProductStock(productId: string | null) {
  return useQuery({
    queryKey: ["products", productId, "stock"],
    queryFn: () => productsService.getProductStock(productId!),
    enabled: productId !== null,
  });
}
