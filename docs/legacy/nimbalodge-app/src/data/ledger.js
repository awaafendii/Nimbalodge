// Journal de caisse — Juillet 2026
export const INITIAL_CAISSE = [
  { date: "2026-07-01", ref: "SOLDE", label: "Solde reporté (juin)", who: "—", debit: 1_845_311, credit: 0 },
  { date: "2026-07-02", ref: "Appro-caisse", label: "Approvisionnement caisse par chèque", who: "Ecobank", debit: 10_000_000, credit: 0 },
  { date: "2026-07-03", ref: "Caisse", label: "Recharge EDG au 1A", who: "EDG", debit: 0, credit: 250_000 },
  { date: "2026-07-04", ref: "Caisse", label: "Recharge wifi illimité au 1B", who: "Orange", debit: 0, credit: 490_000 },
  { date: "2026-07-05", ref: "Caisse", label: "Règlement facture poubelles", who: "Ville propre", debit: 0, credit: 500_000 },
  { date: "2026-07-07", ref: "Caisse", label: "Achat 80L carburant groupe", who: "Station Total", debit: 0, credit: 960_000 },
  { date: "2026-07-09", ref: "Caisse", label: "Réabonnement Canal+ au 1C", who: "Canal+", debit: 0, credit: 253_540 },
  { date: "2026-07-11", ref: "Caisse", label: "Salaire Kanté & Néma", who: "Kanté / Néma", debit: 0, credit: 2_400_000 },
  { date: "2026-07-11", ref: "Caisse", label: "Salaire Arsène", who: "Arsène", debit: 0, credit: 2_000_000 },
  { date: "2026-07-11", ref: "Caisse", label: "Salaire Lamarana", who: "Lamarana", debit: 0, credit: 3_000_000 },
  { date: "2026-07-11", ref: "Caisse", label: "Salaire ménagère du matin", who: "Maimouna", debit: 0, credit: 800_000 },
  { date: "2026-07-14", ref: "Caisse", label: "Entretien des climatiseurs", who: "Technicien clim", debit: 0, credit: 950_000 },
  { date: "2026-07-18", ref: "Appro-caisse", label: "Approvisionnement caisse OM", who: "Iliassa", debit: 5_000_000, credit: 0 },
  { date: "2026-07-18", ref: "Caisse", label: "Paiement de la facture EDG", who: "EDG", debit: 0, credit: 2_900_000 },
  { date: "2026-07-21", ref: "Caisse", label: "Achat matériel de nettoyage", who: "Quincaillerie", debit: 0, credit: 196_771 },
];

// Journal banque / chèques — Juillet 2026
export const INITIAL_BANQUE = [
  { date: "2026-07-02", ref: "CLIENT", label: "Facture émise — clients du mois", who: "—", debit: 0, credit: 0 },
  { date: "2026-07-02", ref: "CHEQUE 00000101", label: "Règlement facture IP-SARL", who: "IP-SARL", debit: 3_000_000, credit: 0 },
  { date: "2026-07-02", ref: "CAISSE", label: "Paiement de la facture IP-SARL", who: "IP-SARL", debit: 0, credit: 3_000_000 },
  { date: "2026-07-02", ref: "CHEQUE 00000102", label: "Approvisionnement caisse par chèque", who: "Ecobank", debit: 10_000_000, credit: 0 },
  { date: "2026-07-02", ref: "CAISSE", label: "Réception par la caisse", who: "—", debit: 0, credit: 10_000_000 },
  { date: "2026-07-02", ref: "CHEQUE 00000103", label: "Règlement salaires des employés", who: "Ecobank", debit: 8_200_000, credit: 0 },
  { date: "2026-07-02", ref: "CAISSE", label: "Répartition des salaires (voir caisse)", who: "—", debit: 0, credit: 8_200_000 },
];

export function runningBalance(txns) {
  let solde = 0;
  return txns.map((t) => {
    solde += t.debit - t.credit;
    return { ...t, solde };
  });
}

export function ledgerTotals(txns) {
  const totalDebit = txns.reduce((s, t) => s + t.debit, 0);
  const totalCredit = txns.reduce((s, t) => s + t.credit, 0);
  return { totalDebit, totalCredit, solde: totalDebit - totalCredit };
}
