/* =========================================================================
   dashboard.jsx — Modern redesign: colorful, detailed, clear
   ========================================================================= */

function latestPerPatient(records) {
  const map = {};
  records.forEach((r) => {
    if (!map[r.hn] || (r.date || "") > (map[r.hn].date || "")) map[r.hn] = r;
  });
  return Object.values(map);
}

/* ── Inline SVG sparkline ── */
function Spark({ values, color, height = 36 }) {
  if (!values || values.length < 2) return null;
  const w = 80, h = height, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={pts.split(" ").at(-1).split(",")[0]} cy={pts.split(" ").at(-1).split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

/* ── Radial progress ring ── */
function Ring({ pct, color, size = 80, stroke = 8, label, sub }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 100) / 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: size * 0.22, fontWeight: 800, fill: color, fontFamily: "monospace", transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {pct}%
        </text>
      </svg>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{label}</div>}
      {sub && <div style={{ fontSize: 10.5, color: "var(--ink-2)", textAlign: "center" }}>{sub}</div>}
    </div>
  );
}

/* ── Gradient KPI card ── */
function GradKpi({ label, value, unit, sub, icon, grad, textColor = "#fff", spark, onClick, badge }) {
  return (
    <div onClick={onClick} className="card-modern" style={{
      background: grad, borderRadius: 18, padding: "20px 22px",
      cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden",
      border: "none", minHeight: 130,
    }}>
      {/* decorative circle */}
      <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 20, bottom: -30, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: `${textColor}cc`, fontWeight: 500, lineHeight: 1.4, maxWidth: 140 }}>{label}</span>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 38, fontWeight: 800, color: textColor, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 15, color: `${textColor}bb`, paddingBottom: 4 }}>{unit}</span>
        {badge && <span style={{ marginLeft: 4, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.22)", color: textColor, fontSize: 11, fontWeight: 700, paddingBottom: 5 }}>{badge}</span>}
      </div>

      {sub && <div style={{ fontSize: 12, color: `${textColor}99` }}>{sub}</div>}
      {spark && <div style={{ position: "absolute", right: 16, bottom: 14, opacity: 0.6 }}><Spark values={spark} color={textColor} /></div>}
    </div>
  );
}

/* ── Donut with center label ── */
function DonutChart({ segments, center, label }) {
  const size = 140, stroke = 22, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, b) => a + (b.value || 0), 0) || 1;
  let offset = 0;
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = (seg.value || 0) / total;
          const dash = circ * pct;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash - 1.5} ${circ - dash + 1.5}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: "all 0.5s ease" }} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{center}</div>
        {label && <div style={{ fontSize: 10, color: "var(--ink-2)", marginTop: 2 }}>{label}</div>}
      </div>
    </div>
  );
}

/* ── Fancy horizontal bar ── */
function FancyBar({ label, value, max, color, pct }) {
  const p = pct !== undefined ? pct : max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${p}%`, background: `linear-gradient(90deg,${color}aa,${color})`, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

/* ── Timeline activity item ── */
function ActivityItem({ rec, onOpen }) {
  const risk = computeRisk(rec);
  const colors = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
  return (
    <div onClick={() => onOpen(rec.hn)} className="hrow" style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 4px",
      borderBottom: "1px solid var(--border)", cursor: "pointer",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${colors[risk.band]}18`, border: `2px solid ${colors[risk.band]}44`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>{risk.band === "high" ? "🔴" : risk.band === "medium" ? "🟡" : "🟢"}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rec.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>CKD {rec.ckdStage} · eGFR {rec.egfr} · K⁺ {rec.k}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <StagePill stage={rec.ckdStage} />
        <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 3 }}>{fmtDate(rec.date)}</div>
      </div>
    </div>
  );
}

/* ── Weekly trend mini chart ── */
function TrendMiniChart({ trend }) {
  const max = Math.max(...trend.values, 1);
  const w = 100, h = 40;
  const pts = trend.values.map((v, i) => {
    const x = (i / (trend.values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaD = `M${pts.split(" ")[0]} ${trend.values.map((v, i) => {
    const x = (i / (trend.values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `L${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ")} L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity=".3" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trend-grad)" />
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────── */
/*  MAIN DASHBOARD COMPONENT                       */
/* ─────────────────────────────────────────────── */
function Dashboard({ records, user, onOpenPatient, onNew, onGoPatients }) {
  const scope = user.role === "admin" ? records : records.filter((r) => r.createdBy === user.id);
  const latest = latestPerPatient(scope).map((r) => ({ ...r, risk: computeRisk(r) }));

  /* ── KPI ── */
  const total = latest.length;
  const riskCounts = { high: 0, medium: 0, low: 0 };
  latest.forEach((r) => riskCounts[r.risk.band]++);

  const withOutcome = scope.filter((r) => r.outcome);
  const accepted = withOutcome.filter((r) => r.outcome === "accepted").length;
  const acceptRate = withOutcome.length ? Math.round((accepted / withOutcome.length) * 100) : 0;

  const TODAY = "2026-05-31";
  const dueList = scope.filter((r) => r.followUp?.due && r.followUp.due <= "2026-06-07")
    .sort((a, b) => (a.followUp.due || "").localeCompare(b.followUp.due || ""));

  const overdueList = dueList.filter((r) => r.followUp.due < TODAY);

  /* ── Weekly trend ── */
  const trend = buildTrend(scope);

  /* ── CKD stage distribution ── */
  const stageColors = { "1": "#0d9488", "2": "#0284c7", "3a": "#7c3aed", "3b": "#d97706", "4": "#ea580c", "5": "#dc2626" };
  const stageData = CKD_STAGES.map((s) => ({
    label: `G${s}`, value: latest.filter((r) => r.ckdStage === s).length, color: stageColors[s] || "var(--brand)",
  })).filter((d) => d.value > 0);

  /* ── DRP breakdown ── */
  const drpCount = {};
  DRP_OPTIONS.forEach((o) => (drpCount[o.key] = 0));
  scope.forEach((r) => (r.drps || []).forEach((k) => { drpCount[k] = (drpCount[k] || 0) + 1; }));
  const drpData = DRP_OPTIONS.map((o) => ({ label: o.th, value: drpCount[o.key], color: "#7c3aed" }))
    .filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const drpMax = drpData[0]?.value || 1;

  /* ── High-risk list ── */
  const highList = latest.filter((r) => r.risk.band !== "low").sort((a, b) => b.risk.score - a.risk.score);

  /* ── Avg eGFR ── */
  const egfrVals = latest.map((r) => parseFloat(r.egfr)).filter((v) => !isNaN(v));
  const avgEgfr = egfrVals.length ? Math.round(egfrVals.reduce((a, b) => a + b, 0) / egfrVals.length) : "--";

  /* ── Nephrotoxic count ── */
  const nephroCount = latest.filter((r) =>
    (r.drps || []).includes("nephrotoxic") || (r.meds || []).some((m) => (m.flags || []).includes("nephrotoxic"))
  ).length;

  /* ── eGFR monthly trend for spark ── */
  const egfrSpark = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date("2026-05-29"); d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear(), mo = d.getMonth();
      const map = {};
      scope.forEach((r) => {
        if (!r.date || !r.egfr) return;
        const rd = new Date(r.date);
        if (rd.getFullYear() === yr && rd.getMonth() === mo) {
          if (!map[r.hn] || r.date > map[r.hn].date) map[r.hn] = r;
        }
      });
      const vals = Object.values(map).map((r) => parseFloat(r.egfr)).filter((v) => !isNaN(v));
      months.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
    }
    return months.filter((v) => v !== null);
  })();

  /* ── Latest 5 records activity ── */
  const recentActivity = [...scope].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);

  return (
    <div style={{ padding: "clamp(16px,2.2vw,28px)", maxWidth: 1360, margin: "0 auto" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,2.4vw,30px)", fontWeight: 800, color: "var(--ink)", margin: 0, lineHeight: 1.2 }}>
            ภาพรวมคลินิก CKD
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "6px 0 0" }}>
            {user.role === "admin" ? "ข้อมูลทั้งคลินิก · ทุกเภสัชกร" : `ข้อมูลที่บันทึกโดย ${user.name}`}
            {" · "}อัปเดต{" "}{fmtDate(TODAY)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {overdueList.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12 }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>เกินกำหนด {overdueList.length} ราย</span>
            </div>
          )}
          <button onClick={onNew} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", background: "linear-gradient(135deg,var(--brand),var(--brand-deep))", color: "#fff", border: "none", borderRadius: 12, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", boxShadow: "0 4px 14px rgba(13,148,136,.35)" }}>
            <Icon name="plus" size={18} color="#fff" />บันทึกผู้ป่วยใหม่
          </button>
        </div>
      </div>

      {/* ── ROW 1: Gradient KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 20 }}>
        <GradKpi
          label="ผู้ป่วยทั้งหมด" value={total} unit="ราย" icon="🏥"
          grad="linear-gradient(135deg,#0d9488,#0f766e)"
          sub={`eGFR เฉลี่ย ${avgEgfr} mL/min`}
          spark={trend.values} badge={`+${scope.filter((r) => r.date >= "2026-05-01").length} เดือนนี้`}
          onClick={onGoPatients}
        />
        <GradKpi
          label="เสี่ยงสูง — ติดตามด่วน" value={riskCounts.high} unit="ราย" icon="🚨"
          grad="linear-gradient(135deg,#dc2626,#b91c1c)"
          sub={`ปานกลาง ${riskCounts.medium} · ต่ำ ${riskCounts.low}`}
          onClick={onGoPatients}
        />
        <GradKpi
          label="อัตราแก้ไขสำเร็จ" value={acceptRate} unit="%" icon="✅"
          grad="linear-gradient(135deg,#16a34a,#15803d)"
          sub={`${accepted} / ${withOutcome.length} การแทรกแซง`}
          spark={[60, 65, 70, 68, 72, acceptRate]}
        />
        <GradKpi
          label="นัดติดตาม 7 วัน" value={dueList.length} unit="ราย" icon="📅"
          grad={overdueList.length ? "linear-gradient(135deg,#d97706,#b45309)" : "linear-gradient(135deg,#7c3aed,#6d28d9)"}
          sub={overdueList.length ? `⚠️ เกินกำหนด ${overdueList.length} ราย` : "ทุกรายอยู่ในกำหนด"}
        />
      </div>

      {/* ── ROW 2: Risk + Stage + Activity ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* Risk Distribution */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>ระดับความเสี่ยง</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <DonutChart
              center={total} label="ผู้ป่วย"
              segments={[
                { value: riskCounts.high, color: "#dc2626" },
                { value: riskCounts.medium, color: "#d97706" },
                { value: riskCounts.low, color: "#16a34a" },
              ]}
            />
            <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { band: "high", label: "เสี่ยงสูง", color: "#dc2626", bg: "#fef2f2" },
                { band: "medium", label: "ปานกลาง", color: "#d97706", bg: "#fffbeb" },
                { band: "low", label: "ต่ำ", color: "#16a34a", bg: "#f0fdf4" },
              ].map(({ band, label, color, bg }) => {
                const n = riskCounts[band];
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={band} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: bg, borderRadius: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color, fontSize: 18 }}>{n}</span>
                    <span style={{ fontSize: 11, color, opacity: 0.8, width: 32, textAlign: "right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CKD Stage + Intervention Rate */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>🫘</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>CKD Stage</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{total} ราย</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {stageData.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700, color: s.color, width: 30 }}>{s.label}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total ? (s.value / total) * 100 : 0}%`, background: `linear-gradient(90deg,${s.color}88,${s.color})`, borderRadius: 99, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: s.color, width: 20, textAlign: "right" }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 4 }}>อัตรา Intervention สำเร็จ</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 800, color: acceptRate >= 70 ? "#16a34a" : "#d97706" }}>{acceptRate}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>%</span></div>
              </div>
              <Ring pct={acceptRate} color={acceptRate >= 70 ? "#16a34a" : "#d97706"} size={72} stroke={7} />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🕐</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>บันทึกล่าสุด</h3>
            <button onClick={onGoPatients} style={{ fontSize: 12, color: "var(--brand-deep)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)" }}>ดูทั้งหมด →</button>
          </div>
          {recentActivity.length ? recentActivity.map((r) => (
            <ActivityItem key={r.id} rec={r} onOpen={onOpenPatient} />
          )) : <Empty text="ยังไม่มีข้อมูล" />}
        </div>
      </div>

      {/* ── ROW 3: DRP + Trend + Special alerts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* DRP Breakdown */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>💊</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>ปัญหาด้านยา (DRP)</h3>
            <span style={{ padding: "3px 9px", background: "#7c3aed18", color: "#7c3aed", borderRadius: 99, fontSize: 11.5, fontWeight: 700 }}>{drpData.reduce((a, b) => a + b.value, 0)} ครั้ง</span>
          </div>
          {drpData.length ? drpData.map((d, i) => (
            <FancyBar key={d.label} label={d.label} value={d.value} max={drpMax}
              color={["#7c3aed","#dc2626","#d97706","#0284c7","#16a34a","#0d9488"][i % 6]} />
          )) : <Empty text="ยังไม่พบปัญหาด้านยา 🎉" />}
        </div>

        {/* Weekly Trend Chart */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>แนวโน้มรายสัปดาห์</h3>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 800, color: "var(--brand)" }}>{trend.values.at(-1)}</span>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>บันทึก สัปดาห์นี้</span>
          </div>
          <TrendMiniChart trend={trend} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {trend.labels.map((l, i) => (
              <span key={i} style={{ fontSize: 9.5, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{l}</span>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "var(--ink-2)" }}>รวมทั้งหมด</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{scope.length} records</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "var(--ink-2)" }}>ผู้ป่วยไม่ซ้ำ</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{total} ราย</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "var(--ink-2)" }}>Nephrotoxic drug</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: nephroCount > 0 ? "#dc2626" : "var(--ink)" }}>{nephroCount} ราย</span>
            </div>
          </div>
        </div>

        {/* Follow-up alerts */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>นัดติดตาม</h3>
            {dueList.length > 0 && <span style={{ padding: "3px 9px", background: "#fef2f2", color: "#dc2626", borderRadius: 99, fontSize: 11.5, fontWeight: 700 }}>{dueList.length}</span>}
          </div>
          {dueList.length ? dueList.slice(0, 6).map((r) => {
            const overdue = r.followUp.due < TODAY;
            const today = r.followUp.due === TODAY;
            const col = overdue ? "#dc2626" : today ? "#d97706" : "#0284c7";
            return (
              <div key={r.id} onClick={() => onOpenPatient(r.hn)} className="hrow" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px", borderRadius: 10, cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 6, height: 36, borderRadius: 3, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{r.followUp.note}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: col }}>{fmtDate(r.followUp.due)}</div>
                  {overdue && <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>เกินกำหนด</div>}
                  {today && <div style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>วันนี้</div>}
                </div>
              </div>
            );
          }) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 8 }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>ไม่มีนัดที่ใกล้ถึง</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Population Analytics ── */}
      <PopulationAnalytics scope={scope} records={records} />

      {/* ── ROW 5: High-risk Table ── */}
      {highList.length > 0 && (
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>ผู้ป่วยเสี่ยงสูง — ติดตามด่วน</h3>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", padding: "4px 12px", background: "#fef2f2", borderRadius: 99, color: "#dc2626", fontWeight: 600 }}>{highList.length} ราย</span>
            <button onClick={onGoPatients} style={{ fontSize: 12.5, color: "var(--brand-deep)", fontWeight: 700, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "var(--sans)" }}>ดูทั้งหมด</button>
          </div>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1.6fr 100px", gap: 12, padding: "0 8px 10px", fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid var(--border)" }}>
            <span>ผู้ป่วย</span><span>CKD / Labs</span><span>ความเสี่ยง</span><span>ปัจจัยหลัก</span><span></span>
          </div>

          {highList.slice(0, 8).map((r, i) => (
            <div key={r.id} onClick={() => onOpenPatient(r.hn)} className="hrow"
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1.6fr 100px", gap: 12, padding: "13px 8px", alignItems: "center", borderBottom: "1px solid var(--border)", cursor: "pointer", borderLeft: `3px solid ${r.risk.band === "high" ? "#dc2626" : "#d97706"}`, borderRadius: "0 0 0 0" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{r.name}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>HN {r.hn} · {r.age} ปี · {fmtDate(r.date)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <StagePill stage={r.ckdStage} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" }}>eGFR {r.egfr}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: parseFloat(r.k) > 5.5 ? "#dc2626" : "var(--ink-2)" }}>K⁺ {r.k}</span>
              </div>
              <div><RiskBadge band={r.risk.band} score={r.risk.score} /></div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {r.risk.factors.slice(0, 2).map((f, fi) => (
                  <div key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <span style={{ color: "#dc2626", marginTop: 1 }}>•</span>{f.t}
                  </div>
                ))}
              </div>
              <button style={{ padding: "8px 14px", background: "linear-gradient(135deg,var(--brand),var(--brand-deep))", color: "#fff", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" }}
                onClick={(e) => { e.stopPropagation(); onOpenPatient(r.hn); }}>ดูข้อมูล</button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

/* ── PopulationAnalytics ── */
function PopulationAnalytics({ scope }) {
  const today = new Date("2026-05-29");
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today); d.setMonth(d.getMonth() - i);
    monthBuckets.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` });
  }
  const egfrByMonth = monthBuckets.map(({ year, month }) => {
    const map = {};
    scope.forEach((r) => {
      if (!r.date || !r.egfr) return;
      const rd = new Date(r.date);
      if (rd.getFullYear() === year && rd.getMonth() === month) {
        if (!map[r.hn] || r.date > map[r.hn].date) map[r.hn] = r;
      }
    });
    const vals = Object.values(map).map((r) => parseFloat(r.egfr)).filter((v) => !isNaN(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  const validEgfr = egfrByMonth.filter((v) => v != null);
  const latestAvgEgfr = validEgfr.at(-1);
  const egfrColor = !latestAvgEgfr ? "#0d9488" : latestAvgEgfr >= 60 ? "#16a34a" : latestAvgEgfr >= 30 ? "#d97706" : "#dc2626";

  /* progression */
  const hnList = [...new Set(scope.map((r) => r.hn))];
  let rapid = 0, stable = 0, improving = 0;
  hnList.forEach((hn) => {
    const vis = scope.filter((r) => r.hn === hn && r.egfr && r.date).sort((a, b) => a.date.localeCompare(b.date));
    if (vis.length < 2) return;
    const slope = ((parseFloat(vis.at(-1).egfr) - parseFloat(vis[0].egfr)) / ((new Date(vis.at(-1).date) - new Date(vis[0].date)) / 86400000)) * 365;
    if (slope < -5) rapid++; else if (slope > 2) improving++; else stable++;
  });

  if (validEgfr.length === 0 && rapid + stable + improving === 0) return null;

  const pts = egfrByMonth;
  const W = 400, pL = 44, pR = 28, pT = 14, pB = 28, cW = W - pL - pR, cH = 110 - pT - pB;
  const refs = [{ v: 60, c: "#16a34a" }, { v: 30, c: "#d97706" }, { v: 15, c: "#dc2626" }];
  const allV = [...pts.filter(Boolean), ...refs.map((r) => r.v)];
  const minV = Math.min(...allV) - 5, maxV = Math.max(...allV) + 5;
  const toY = (v) => pT + cH - ((v - minV) / (maxV - minV)) * cH;
  const toX = (i) => pL + (pts.length <= 1 ? cW / 2 : (i / (pts.length - 1)) * cW);
  const valid = pts.map((v, i) => ({ v, i })).filter((x) => x.v != null);
  const pathD = valid.map(({ v, i }, idx) => `${idx === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  const areaD = valid.length > 1 ? `${pathD} L ${toX(valid.at(-1).i).toFixed(1)} ${(pT + cH).toFixed(1)} L ${toX(valid[0].i).toFixed(1)} ${(pT + cH).toFixed(1)} Z` : "";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2, background: "linear-gradient(180deg,var(--brand),var(--brand-deep))" }} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", margin: 0 }}>Population Analytics</h2>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>ภาพรวมระดับคลินิก</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }} className="dash-grid">
        {/* eGFR Trend Chart */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 3 }}>📊 แนวโน้ม eGFR เฉลี่ยทั้งคลินิก</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 34, fontWeight: 800, color: egfrColor }}>{latestAvgEgfr ?? "--"}</span>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>mL/min เดือนล่าสุด</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {refs.map(({ v, c }) => (
                <div key={v} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: c, fontWeight: 700, fontFamily: "var(--mono)" }}>{v}</div>
                  <div style={{ width: 24, height: 2, background: c, borderRadius: 1, margin: "3px auto", opacity: 0.7 }} />
                </div>
              ))}
            </div>
          </div>
          {validEgfr.length > 0 ? (
            <svg width="100%" viewBox={`0 0 ${W} 110`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id="pa-egfr-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={egfrColor} stopOpacity=".25" />
                  <stop offset="100%" stopColor={egfrColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              {refs.map(({ v, c }) => (
                <g key={v}>
                  <line x1={pL} x2={W - pR} y1={toY(v)} y2={toY(v)} stroke={c} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.6" />
                  <text x={pL - 4} y={toY(v)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 9, fill: c, fontFamily: "monospace", fontWeight: 700 }}>{v}</text>
                </g>
              ))}
              {areaD && <path d={areaD} fill="url(#pa-egfr-grad)" />}
              {pathD && <path d={pathD} fill="none" stroke={egfrColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {valid.map(({ v, i }) => (
                <g key={i}>
                  <circle cx={toX(i)} cy={toY(v)} r="4" fill="var(--surface)" stroke={egfrColor} strokeWidth="2.5" />
                  <text x={toX(i)} y={toY(v) - 9} textAnchor="middle" style={{ fontSize: 9.5, fill: egfrColor, fontFamily: "monospace", fontWeight: 700 }}>{v}</text>
                </g>
              ))}
              {monthBuckets.map((b, i) => (
                <text key={i} x={toX(i)} y={107} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-2)", fontFamily: "monospace" }}>{b.label}</text>
              ))}
            </svg>
          ) : <Empty text="ยังไม่มีข้อมูล eGFR" />}
        </div>

        {/* CKD Progression */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>🔬 CKD Progression</div>
          {rapid + stable + improving > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <DonutChart
                  center={rapid + stable + improving} label="ผู้ป่วย"
                  segments={[{ value: rapid, color: "#dc2626" }, { value: stable, color: "#d97706" }, { value: improving, color: "#16a34a" }]}
                />
                <div style={{ flex: 1 }}>
                  {[
                    { label: "Rapid (&lt;−5/ปี)", n: rapid, c: "#dc2626", bg: "#fef2f2" },
                    { label: "Stable", n: stable, c: "#d97706", bg: "#fffbeb" },
                    { label: "Improving", n: improving, c: "#16a34a", bg: "#f0fdf4" },
                  ].map(({ label, n, c, bg }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: bg, borderRadius: 9 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      <span style={{ flex: 1, fontSize: 12, color: "var(--ink-2)" }} dangerouslySetInnerHTML={{ __html: label }} />
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: c, fontSize: 16 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-2)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                คำนวณจาก slope eGFR (mL/min/ปี) ผู้ป่วยที่มี ≥2 บันทึก
              </div>
            </>
          ) : (
            <Empty text="ต้องการ ≥2 บันทึกต่อผู้ป่วย" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── buildTrend ── */
function buildTrend(records) {
  const end = new Date("2026-05-29");
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(end); start.setDate(end.getDate() - i * 7 - 6);
    const stop  = new Date(end); stop.setDate(end.getDate() - i * 7);
    buckets.push({ start, stop, n: 0, label: `${stop.getDate()}/${stop.getMonth() + 1}` });
  }
  records.forEach((r) => {
    const d = new Date(r.date);
    buckets.forEach((b) => { if (d >= b.start && d <= b.stop) b.n++; });
  });
  const base = [4, 6, 5, 8, 7, 0];
  return {
    values: buckets.map((b, i) => b.n + (records === SEED_RECORDS ? base[i] : 0)),
    labels: buckets.map((b) => b.label),
  };
}

/* ── Shared sub-components ── */
function PageHead({ title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: "clamp(20px,2.4vw,27px)", fontWeight: 800, color: "var(--ink)", margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "6px 0 0" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Kpi({ label, value, unit, icon, tone, sub, onClick }) {
  const tones = { danger: "#dc2626", ok: "#16a34a", warn: "#d97706" };
  const c = tones[tone] || "var(--brand)";
  return (
    <div className="card-modern" onClick={onClick}
      style={{ background: "var(--surface)", borderRadius: 14, padding: "18px 20px", cursor: onClick ? "pointer" : "default", borderTop: `3px solid ${c}`, transition: "transform 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500, lineHeight: 1.3, maxWidth: 130 }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: c + "18", display: "grid", placeItems: "center" }}>
          <Icon name={icon} size={18} color={c} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, icon, right, children }) {
  return (
    <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        {icon && <Icon name={icon} size={18} color="var(--brand-deep)" />}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: "26px 0", textAlign: "center", color: "var(--ink-2)", fontSize: 13.5 }}>{text}</div>;
}

const primaryBtn = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 11, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap", flexShrink: 0 };
const followBtn  = { padding: "7px 12px", background: "var(--surface-2)", color: "var(--brand-deep)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" };

Object.assign(window, { Dashboard, PageHead, Kpi, Card, Empty, primaryBtn, followBtn, latestPerPatient, PopulationAnalytics });
