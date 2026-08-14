import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { INITIAL_INVOICES } from "../data/invoices.js";
import { INITIAL_CAISSE, INITIAL_BANQUE } from "../data/ledger.js";
import { CURRENT_LEDGER_MONTH } from "../data/months.js";

const AppCtx = createContext(null);

const initialState = {
  theme: "auto", // "auto" | "light" | "dark"
  currency: "GNF", // "GNF" | "USD"
  period: CURRENT_LEDGER_MONTH,
  invoices: INITIAL_INVOICES,
  caisse: INITIAL_CAISSE,
  banque: INITIAL_BANQUE,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "SET_PERIOD":
      return { ...state, period: action.period };
    case "ADD_INVOICE":
      return { ...state, invoices: [action.invoice, ...state.invoices] };
    case "MARK_INVOICE_PAID":
      return {
        ...state,
        invoices: state.invoices.map((inv) => (inv.num === action.num ? { ...inv, status: "paid" } : inv)),
      };
    case "ADD_TRANSACTION": {
      const key = action.ledger === "banque" ? "banque" : "caisse";
      return { ...state, [key]: [...state[key], action.txn] };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  const actions = useMemo(
    () => ({
      setTheme: (theme) => dispatch({ type: "SET_THEME", theme }),
      setCurrency: (currency) => dispatch({ type: "SET_CURRENCY", currency }),
      setPeriod: (period) => dispatch({ type: "SET_PERIOD", period }),
      addInvoice: (invoice) => dispatch({ type: "ADD_INVOICE", invoice }),
      markInvoicePaid: (num) => dispatch({ type: "MARK_INVOICE_PAID", num }),
      addTransaction: (ledger, txn) => dispatch({ type: "ADD_TRANSACTION", ledger, txn }),
    }),
    []
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}
