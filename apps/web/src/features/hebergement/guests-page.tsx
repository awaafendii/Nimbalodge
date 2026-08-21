import { GuestsCard } from "../guests/index.js";
import { GuestsKpiBand } from "./guests-kpi-band.js";

// Hébergement → Clients. Header = Topbar. Dashboard/KPI = GuestsKpiBand (nouveau). Tableau +
// formulaire = GuestsCard réutilisée telle quelle depuis features/guests/index.js.
export default function HebergementGuestsPage() {
  return (
    <div className="flex flex-col gap-5">
      <GuestsKpiBand />
      <GuestsCard />
    </div>
  );
}
