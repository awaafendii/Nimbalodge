export function Kpi({ icon, iconClass = "", label, value, delta, note }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className={"kpi-icon " + iconClass}>{icon}</span>
        {delta ? (
          <span className={"kpi-delta " + (delta.sentiment === "up" ? "up" : "down")}>
            {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value)}%
          </span>
        ) : null}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tabular">{value}</div>
      {note ? <div className="kpi-label" style={{ marginTop: -4 }}>{note}</div> : null}
    </div>
  );
}
