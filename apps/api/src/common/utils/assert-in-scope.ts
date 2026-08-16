import { ForbiddenException } from "@nestjs/common";

import type { AuthenticatedUser } from "../types/authenticated-request";

// Extrait de ~30 services identiques (voir docs/architecture/audit-master-prompt-v2.md, section Q)
// — l'isolation multi-tenant elle-même n'a pas changé : org-wide voit toute son organisation, un
// demandeur hôtel-scopé ne voit que son propre hôtel. Fonction pure (pas un provider Nest) : le
// remplacement direct `this.assertInScope(...)` → `assertInScope(...)` ne nécessite aucun câblage
// de module, juste un import. `hotelId: string | null` (pas juste `string`) : UsersService est le
// seul appelant où la ressource elle-même (`User.hotelId`) peut être nulle (utilisateur org-wide).
export function assertInScope(organizationId: string, hotelId: string | null, requester: AuthenticatedUser): void {
  if (organizationId !== requester.organizationId) {
    throw new ForbiddenException("Hors périmètre de votre organisation");
  }
  if (requester.hotelId && hotelId !== requester.hotelId) {
    throw new ForbiddenException("Hors périmètre de votre hôtel");
  }
}

// Étape 5 — UserDepartment enfin exploité (voir docs/architecture/audit-master-prompt-v2.md,
// section J : la table existe depuis la Phase 4 mais n'était lue par aucun guard). Scope
// additif et opt-in : un demandeur SANS affectation département (le cas de tous les
// HOTEL_ADMIN existants aujourd'hui) n'est pas restreint — comportement inchangé. Un demandeur
// avec au moins une affectation ne voit/agit que sur les ressources de ses département(s), en
// plus (jamais à la place) de l'isolation organisation/hôtel d'assertInScope.
export function assertInDepartmentScope(departmentId: string | null, requesterDepartmentIds: string[]): void {
  if (requesterDepartmentIds.length === 0) return;
  if (!departmentId || !requesterDepartmentIds.includes(departmentId)) {
    throw new ForbiddenException("Hors périmètre de votre département");
  }
}
