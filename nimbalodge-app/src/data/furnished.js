export const FURNISHED = [
  { appt: "1A", tenant: "Mme Bah", entry: "2026-07-18", exit: "2026-08-18", rate: 466_667 },
  { appt: "1B", tenant: "Aly (libanais)", entry: "2026-07-09", exit: "2026-08-08", rate: 500_000 },
  { appt: "1C", tenant: "TGCC Guinée", entry: "2026-07-19", exit: "2026-08-19", rate: 500_000 },
  { appt: "1D", tenant: "Couple Diallo", entry: "2026-07-10", exit: "2026-07-24", rate: 500_000 },
];

export function nightsBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export const COMMISSION_RATE = 0.1;
export const CLEANING_FEE = 1_800_000;
export const CASH_ADVANCE = 5_000_000;

export function furnishedSummary(rows) {
  const total = rows.reduce((s, f) => s + nightsBetween(f.entry, f.exit) * f.rate, 0);
  const commission = total * COMMISSION_RATE;
  const afterCommission = total - commission;
  const afterCleaning = afterCommission - CLEANING_FEE;
  const net = afterCleaning - CASH_ADVANCE;
  const totalNights = rows.reduce((s, f) => s + nightsBetween(f.entry, f.exit), 0);
  return { total, commission, afterCommission, afterCleaning, net, totalNights };
}
