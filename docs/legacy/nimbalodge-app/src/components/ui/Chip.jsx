const LABELS = {
  good: "À jour",
  warn: "À surveiller",
  crit: "En retard",
  vacant: "Vacant",
  neutral: "—",
  paid: "Payée",
  pending: "En attente",
  late: "En retard",
};

const CLASS_MAP = {
  paid: "good",
  pending: "warn",
  late: "crit",
  good: "good",
  warn: "warn",
  crit: "crit",
  vacant: "neutral",
  neutral: "neutral",
};

export function Chip({ status, children }) {
  const cls = CLASS_MAP[status] || "neutral";
  return <span className={"chip " + cls}>{children ?? LABELS[status] ?? status}</span>;
}
