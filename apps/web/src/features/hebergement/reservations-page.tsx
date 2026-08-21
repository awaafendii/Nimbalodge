import { ReservationsCard } from "../reservations/index.js";
import { ReservationsKpiBand } from "./reservations-kpi-band.js";

// Hébergement → Réservations. Header = Topbar. Dashboard/KPI = ReservationsKpiBand (nouveau).
// Tableau + formulaire + workflow = ReservationsCard réutilisée telle quelle depuis
// features/reservations/index.tsx, aucune règle métier modifiée.
export default function HebergementReservationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ReservationsKpiBand />
      <ReservationsCard />
    </div>
  );
}
