import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as assetsService from "../services/assets.js";
import type { CreateAssetInput, UpdateAssetInput } from "../services/assets.js";

const ASSETS_KEY = ["assets"] as const;

export function useAssets() {
  return useQuery({
    queryKey: ASSETS_KEY,
    queryFn: assetsService.listAssets,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssetInput) => assetsService.createAsset(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssetInput }) => assetsService.updateAsset(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
}
