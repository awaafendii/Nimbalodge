import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@nimbalodge/ui/src/styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
