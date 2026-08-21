import { RoomTypesCard, RoomsCard } from "../rooms/index.js";
import { RoomsKpiBand } from "./rooms-kpi-band.js";

// Hébergement → Chambres. Header = Topbar. Dashboard/KPI = RoomsKpiBand (nouveau). Tableau +
// formulaires = RoomTypesCard + RoomsCard réutilisées telles quelles depuis features/rooms/index.js
// (déjà groupées sur un seul écran avant cette migration), aucune règle métier modifiée.
export default function HebergementRoomsPage() {
  return (
    <div className="flex flex-col gap-5">
      <RoomsKpiBand />
      <RoomTypesCard />
      <RoomsCard />
    </div>
  );
}
