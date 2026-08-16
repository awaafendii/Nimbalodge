import { useQuery } from "@tanstack/react-query";

import * as bankAccountsService from "../services/bank-accounts.js";

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: bankAccountsService.listBankAccounts,
  });
}
