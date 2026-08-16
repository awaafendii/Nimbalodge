export const MONTHS = [
  { key: "2026-02", label: "Février 2026" },
  { key: "2026-03", label: "Mars 2026" },
  { key: "2026-04", label: "Avril 2026" },
  { key: "2026-05", label: "Mai 2026" },
  { key: "2026-06", label: "Juin 2026" },
  { key: "2026-07", label: "Juillet 2026" },
];

export const CURRENT_LEDGER_MONTH = "2026-07";

export function monthLabel(key) {
  const m = MONTHS.find((m) => m.key === key);
  return m ? m.label : key;
}
