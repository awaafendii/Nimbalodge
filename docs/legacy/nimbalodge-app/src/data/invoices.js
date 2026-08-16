export const INITIAL_INVOICES = [
  {
    num: "FAC/2026/07/00011", client: "Fox Cooling SARL", appt: "4A, 5B", date: "2026-07-01", due: "2026-07-22", status: "late",
    lines: [
      { d: "Location Appart 5B — période 01/07 au 01/10/2026", q: 3, pu: 11_160_000 },
      { d: "Location Appart 4A — période 01/07 au 01/10/2026", q: 3, pu: 11_160_000 },
      { d: "Autres frais de location", q: 6, pu: 600_000 },
    ],
  },
  {
    num: "FAC/2026/07/00012", client: "M. Kamano", appt: "4B", date: "2026-07-01", due: "2026-07-15", status: "late",
    lines: [{ d: "Location Appart 4B — mois de juillet", q: 1, pu: 8_500_000 }],
  },
  {
    num: "FAC/2026/06/00009", client: "SOGEA SATOM Guinée", appt: "2A", date: "2026-06-10", due: "2026-06-30", status: "paid",
    lines: [{ d: "Location Appart 2A — période 15/06 au 15/09/2026", q: 3, pu: 11_160_000 }],
  },
  {
    num: "FAC/2026/06/00010", client: "TGCC Guinée S.A.U", appt: "3B", date: "2026-06-08", due: "2026-06-28", status: "paid",
    lines: [{ d: "Location Appart 3B — période 14/06 au 14/09/2026", q: 3, pu: 15_000_000 }],
  },
  {
    num: "FAC/2026/06/00008", client: "MJR-Construction", appt: "5A", date: "2026-06-01", due: "2026-06-20", status: "paid",
    lines: [{ d: "Location Appart 5A — période 01/06 au 01/09/2026", q: 3, pu: 11_160_000 }],
  },
  {
    num: "FAC/2026/07/00013", client: "M. Diallo Youssouf Alseny", appt: "2B", date: "2026-07-02", due: "2026-08-15", status: "pending",
    lines: [{ d: "Location Appart 2B — période 01/07 au 01/10/2026", q: 3, pu: 8_000_000 }],
  },
  {
    num: "FAC/2025/11/00002", client: "Fox Cooling SARL", appt: "4A, 5B", date: "2025-11-09", due: "2025-11-30", status: "paid",
    lines: [
      { d: "Location Appart 5B — période 01/09 au 01/12/2025", q: 3, pu: 11_160_000 },
      { d: "Location Appart 4A — période 01/09 au 01/12/2025", q: 3, pu: 11_160_000 },
      { d: "Autres frais de location", q: 6, pu: 600_000 },
    ],
  },
  {
    num: "FAC/2026/08/00001", client: "M. Barry Thierno Souleymane", appt: "Penthouse 6-7", date: "2026-08-01", due: "2026-08-05", status: "pending", currency: "USD",
    lines: [
      { d: "Location Penthouse semi-meublé", q: 4, pu: 5_000 },
      { d: "Charges & entretien", q: 1, pu: 2_000 },
    ],
  },
];

export function invoiceTotal(inv) {
  return inv.lines.reduce((s, l) => s + l.q * l.pu, 0);
}
