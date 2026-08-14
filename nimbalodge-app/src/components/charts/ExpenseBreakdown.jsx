import { fmtGNF } from "../../utils/format.js";

export function ExpenseBreakdown({ categories }) {
  const total = categories.reduce((s, c) => s + c.value, 0);

  return (
    <div>
      {categories.map((c) => {
        const pct = Math.round((c.value / total) * 100);
        return (
          <div key={c.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: "none" }} />
              <span className="text" style={{ flex: 1, fontSize: 12.4, color: "var(--ink-2)" }}>
                {c.label}
              </span>
              <span className="tabular" style={{ fontSize: 12.4, fontWeight: "var(--fw-subtitle-strong)" }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: pct + "%", background: c.color, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTop: "1px solid var(--border-soft)",
          fontSize: 12.6,
        }}
      >
        <span className="small">Total dépenses</span>
        <b className="tabular">{fmtGNF(total)}</b>
      </div>
    </div>
  );
}
