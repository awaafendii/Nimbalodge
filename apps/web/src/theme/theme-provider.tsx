import { useEffect } from "react";

import { useUIStore } from "../stores/ui-store.js";

// Reproduit l'effet de nimbalodge-app/src/state/AppContext.jsx : "auto" retire l'attribut
// data-theme (tokens.css bascule alors via @media prefers-color-scheme), sinon on le fixe
// explicitement pour forcer clair/sombre.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return children;
}
