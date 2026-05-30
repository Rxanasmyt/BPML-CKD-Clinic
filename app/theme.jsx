/* =========================================================================
   theme.jsx — ธีมสี (3 แนว), CSS variables, และ UI primitives + กราฟ SVG
   ========================================================================= */

const THEMES = {
  teal: {
    label: "Teal Health (เขียว-เทียล)",
    "--brand": "#0d9488", "--brand-deep": "#0f766e", "--brand-soft": "#ccfbf1",
    "--accent": "#0e7490", "--ink": "#0f2a2e", "--ink-2": "#3f5b5e",
    "--bg": "#f1f6f5", "--surface": "#ffffff", "--surface-2": "#f7faf9",
    "--border": "#dce7e5", "--sidebar": "#0c3b3a", "--sidebar-ink": "#cdeae6",
    "--sidebar-active": "#0d9488",
  },
  navy: {
    label: "Deep Navy (น้ำเงินเข้ม)",
    "--brand": "#1e4ba3", "--brand-deep": "#16387a", "--brand-soft": "#dbe7fb",
    "--accent": "#0d9488", "--ink": "#10203f", "--ink-2": "#445069",
    "--bg": "#eef2f8", "--surface": "#ffffff", "--surface-2": "#f6f8fc",
    "--border": "#dde4ef", "--sidebar": "#0f2247", "--sidebar-ink": "#c3d2ec",
    "--sidebar-active": "#2b62c4",
  },
  soft: {
    label: "Soft Clinical (อ่อนสบายตา)",
    "--brand": "#3a8a86", "--brand-deep": "#2f706c", "--brand-soft": "#d9eeec",
    "--accent": "#5b87b8", "--ink": "#293439", "--ink-2": "#5c6b71",
    "--bg": "#f4f3ee", "--surface": "#fffefb", "--surface-2": "#faf9f4",
    "--border": "#e6e3d9", "--sidebar": "#2b3a40", "--sidebar-ink": "#cdd6d3",
    "--sidebar-active": "#3a8a86",
  },
  dark: {
    label: "Dark Mode (โหมดมืด)",
    "--brand": "#2dd4bf", "--brand-deep": "#14b8a6", "--brand-soft": "#0f2a2a",
    "--accent": "#818cf8", "--ink": "#f1f5f9", "--ink-2": "#94a3b8",
    "--bg": "#0f172a", "--surface": "#1e293b", "--surface-2": "#334155",
    "--border": "#334155", "--sidebar": "#0f172a", "--sidebar-ink": "#94a3b8",
    "--sidebar-active": "#1d4ed8",
  },
};

function applyTheme(key, density) {
  const t = THEMES[key] || THEMES.teal;
  const root = document.documentElement;
  Object.entries(t).forEach(([k, v]) => { if (k.startsWith("--")) root.style.setProperty(k, v); });
  const pad = density === "compact" ? "0.55rem" : density === "comfy" ? "0.95rem" : "0.72rem";
  root.style.setProperty("--cell-pad", pad);
}

/* ---------- ไอคอน (เส้น, สไตล์เดียวกันทั้งแอป) ---------- */
function Icon({ name, size = 20, color = "currentColor", stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    patients: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><circle cx="17.5" cy="9" r="2.4" /><path d="M16 20a4 4 0 0 1 5.5-3.7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
    chevronR: <><path d="m9 6 6 6-6 6" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    alert: <><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
    kidney: <><path d="M8 4C5 4 3.5 6.5 3.5 9.5c0 3.5 2 6 4.5 6 1.6 0 2-1 2-2.5 0-2 1-3 2-3s2 1 2 3c0 1.5.4 2.5 2 2.5 2.5 0 4.5-2.5 4.5-6C20.5 6.5 19 4 16 4c-2 0-3 1.5-4 1.5S10 4 8 4z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
    pill: <><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    trend: <><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    shield: <><path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

/* ---------- Badge ความเสี่ยง ---------- */
function RiskBadge({ band, score, small }) {
  const m = RISK_META[band] || RISK_META.low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700,
      fontSize: small ? 11 : 12.5, color: m.color, background: m.bg,
      border: `1px solid ${m.border}`, padding: small ? "2px 8px" : "3px 10px",
      borderRadius: 999, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: m.color }} />
      {m.th}{score != null && <span style={{ opacity: .65, fontVariantNumeric: "tabular-nums" }}>· {score}</span>}
    </span>
  );
}

function StagePill({ stage }) {
  const high = stage === "4" || stage === "5";
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
      color: high ? "#b91c1c" : "var(--brand-deep)",
      background: high ? "#fef2f2" : "var(--brand-soft)",
      padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap",
    }}>CKD {stage}</span>
  );
}

/* ---------- กราฟ SVG (ไม่พึ่ง lib ภายนอก) ---------- */
function Donut({ segments, size = 150, thickness = 22, center }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} opacity={.4} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-off} strokeLinecap="butt" />;
          off += len; return el;
        })}
      </g>
      {center != null && (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 30, fill: "var(--ink)" }}>{center}</text>
      )}
    </svg>
  );
}

function HBars({ data, color = "var(--brand)", maxLabel = 150 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `${maxLabel}px 1fr 34px`, alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--ink-2)", textAlign: "right", lineHeight: 1.2 }}>{d.label}</div>
          <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color || color, borderRadius: 6, transition: "width .5s" }} />
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points, height = 130, color = "var(--brand)", labels }) {
  const w = 480, pad = 8;
  const max = Math.max(...points, 1), min = 0;
  const stepX = (w - pad * 2) / (points.length - 1 || 1);
  const y = (v) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${y(p)}`).join(" ");
  const area = `${path} L ${pad + (points.length - 1) * stepX} ${height - pad} L ${pad} ${height - pad} Z`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lg)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={pad + i * stepX} cy={y(p)} r="3.2" fill="var(--surface)" stroke={color} strokeWidth="2" />)}
      </svg>
      {labels && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {labels.map((l, i) => <span key={i} style={{ fontSize: 11, color: "var(--ink-2)" }}>{l}</span>)}
      </div>}
    </div>
  );
}

Object.assign(window, { THEMES, applyTheme, Icon, RiskBadge, StagePill, Donut, HBars, LineChart });
