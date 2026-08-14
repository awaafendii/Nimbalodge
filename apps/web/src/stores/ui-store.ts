import { create } from "zustand";
import { persist } from "zustand/middleware";

// Porte la logique de nimbalodge-app/src/state/AppContext.jsx (theme + toggle sidebar) sur
// Zustand au lieu d'un useReducer + Context React. Seul état UI transverse pour l'instant — aucun
// état métier (recettes/dépenses/etc.) tant que l'API n'existe pas (Phase 2+).

export type Theme = "light" | "dark" | "auto";

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "auto",
      setTheme: (theme) => set({ theme }),
      sidebarOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),
    }),
    {
      name: "nimbalodge:web:ui",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
