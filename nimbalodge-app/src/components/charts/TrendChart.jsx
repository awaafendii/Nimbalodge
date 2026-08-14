import { useRef, useState } from "react";
import { fmtGNF } from "../../utils/format.js";

const W = 560;
const H = 190;
const PAD = { l: 8, r: 8, t: 14, b: 26 };

export function TrendChart({ data }) {
  const svgRef = useRef(null);
  const [tip, setTip] = useState(null); // { x, y, idx }

  const max = Math.max(...data.map((t) => t.rec)) * 1.12;
  const bw = (W - PAD.l - PAD.r) / data.length;
  const x = (i) => PAD.l + i * bw + bw / 2;
  const y = (v) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);

  const linePts = (key) => data.map((t, i) => `${x(i)},${y(t[key])}`).join(" ");
  const areaPts = `${PAD.l},${y(0)} ` + data.map((t, i) => `${x(i)},${y(t.rec)}`).join(" ") + ` ${W - PAD.r},${y(0)}`;
  const gridLines = [0.25, 0.5, 0.75, 1];

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let idx = Math.round((relX - PAD.l - bw / 2) / bw);
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setTip({ clientX: e.clientX, clientY: e.clientY, idx });
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: 210, overflow: "visible" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--border-soft)" strokeWidth="1" />
        ))}
        <polygon points={areaPts} fill="url(#areaGrad)" />
        <polyline points={linePts("dep")} fill="none" stroke="var(--ink-muted)" strokeWidth="1.8" strokeDasharray="3 3" strokeLinecap="round" />
        <polyline points={linePts("rec")} fill="none" stroke="var(--chart-1)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((t, i) => (
          <circle key={"d" + i} cx={x(i)} cy={y(t.dep)} r="2.6" fill="var(--ink-muted)" />
        ))}
        {data.map((t, i) => (
          <circle
            key={"r" + i}
            cx={x(i)}
            cy={y(t.rec)}
            r={i === data.length - 1 ? 4.5 : 3}
            fill="var(--chart-1)"
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
        ))}
        {data.map((t, i) => (
          <text key={"l" + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-muted)">
            {t.m}
          </text>
        ))}
      </svg>
      {tip ? (
        <div
          style={{
            position: "fixed",
            left: tip.clientX + 14,
            top: tip.clientY - 10,
            pointerEvents: "none",
            background: "var(--ink)",
            color: "var(--bg)",
            fontSize: 11.5,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            padding: "7px 10px",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            zIndex: 70,
            whiteSpace: "nowrap",
          }}
        >
          <b>{data[tip.idx].m} 2026</b>
          <br />
          Recettes {fmtGNF(data[tip.idx].rec)}
          <br />
          Dépenses {fmtGNF(data[tip.idx].dep)}
        </div>
      ) : null}
    </div>
  );
}
