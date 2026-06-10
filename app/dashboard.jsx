/* =========================================================================
   dashboard.jsx — Animated modern dashboard
   ========================================================================= */

/* ── useCounter: animate number from 0 to target ── */
function useCounter(target, duration = 900) {
  const [val, setVal] = React.useState(0);
  const start = React.useRef(null);
  const frame = React.useRef(null);
  const prev  = React.useRef(0);
  React.useEffect(() => {
    if (typeof target !== "number" || isNaN(target)) return;
    const from = prev.current;
    const to   = target;
    prev.current = target;
    start.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    function tick(ts) {
      if (!start.current) start.current = ts;
      const p = Math.min((ts - start.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
      setVal(Math.round(from + (to - from) * ease));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target]);
  return val;
}

/* ── useMounted: returns true after first paint ── */
function useMounted(delay = 80) {
  const [m, setM] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, []);
  return m;
}

/* ── ripple effect for buttons ── */
function addRipple(e) {
  const btn = e.currentTarget;
  const r = btn.getBoundingClientRect();
  const d = Math.max(r.width, r.height);
  const el = document.createElement("span");
  el.className = "ripple-el";
  el.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  btn.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function latestPerPatient(records) {
  const map = {};
  records.forEach((r) => {
    if (!map[r.hn] || (r.date || "") > (map[r.hn].date || "")) map[r.hn] = r;
  });
  return Object.values(map);
}

/* ── Animated Sparkline ── */
function Spark({ values, color, height = 36 }) {
  const mounted = useMounted(100);
  if (!values || values.length < 2) return null;
  const w = 80, h = height, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPt = pts.split(" ").at(-1).split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
        pathLength={mounted ? undefined : "1"}
        style={mounted ? { strokeDasharray: "none" } : { strokeDasharray: "1", strokeDashoffset: "0", animation: "draw-path 0.9s ease-out both" }} />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.3s 0.8s" }} />
    </svg>
  );
}

/* ── Animated Radial Ring ── */
function Ring({ pct, color, size = 80, stroke = 8, label, sub }) {
  const mounted = useMounted(200);
  const animPct = useCounter(mounted ? pct : 0, 800);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(animPct, 100) / 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.05s linear", filter: `drop-shadow(0 0 4px ${color}66)` }} />
        <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: size*0.22, fontWeight: 800, fill: color, fontFamily: "monospace",
            transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}>
          {animPct}%
        </text>
      </svg>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{label}</div>}
      {sub   && <div style={{ fontSize: 10.5, color: "var(--ink-2)", textAlign: "center" }}>{sub}</div>}
    </div>
  );
}

/* ── Glassmorphism Gradient KPI Card ── */
function GradKpi({ label, value, unit, sub, icon, grad, textColor="#fff", spark, onClick, badge, stagger=0 }) {
  const num = useCounter(typeof value === "number" ? value : 0, 800);
  const display = typeof value === "number" ? num : value;
  const delays = [0, 0.04, 0.09, 0.14, 0.20];
  return (
    <div onClick={(e)=>{ if(onClick){addRipple(e);onClick();} }} className={`kpi-grad card-modern btn-primary`}
      style={{ background: grad, borderRadius: 20, padding: "22px 24px", cursor: onClick?"pointer":"default",
        position: "relative", overflow: "hidden", border: "none", minHeight: 138,
        animation: `fadeUp 0.42s cubic-bezier(0.22,1,0.36,1) ${delays[stagger]||0}s both` }}>
      {/* Floating decorative orbs */}
      <div className="float-anim" style={{ position: "absolute", right: -24, top: -24, width: 110, height: 110,
        borderRadius: "50%", background: "rgba(255,255,255,.09)", pointerEvents: "none" }} />
      <div className="float-anim-2" style={{ position: "absolute", right: 22, bottom: -36, width: 80, height: 80,
        borderRadius: "50%", background: "rgba(255,255,255,.06)", pointerEvents: "none" }} />
      {/* Shine sweep */}
      <div style={{ position: "absolute", top: 0, left: "-100%", width: "60%", height: "100%",
        background: "linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)",
        pointerEvents: "none", animation: "shimmer 3s ease-in-out infinite" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative" }}>
        <span style={{ fontSize: 12.5, color: `${textColor}cc`, fontWeight: 500, lineHeight: 1.4, maxWidth: 150 }}>{label}</span>
        <span style={{ fontSize: 24, lineHeight: 1, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.3))" }}>{icon}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 4, position: "relative" }}>
        <span className="num-pop" key={display}
          style={{ fontFamily: "var(--mono)", fontSize: 42, fontWeight: 800, color: textColor, lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,.2)" }}>
          {display}
        </span>
        <span style={{ fontSize: 16, color: `${textColor}bb`, paddingBottom: 5 }}>{unit}</span>
        {badge && <span style={{ marginLeft: 4, padding: "3px 9px 3px", borderRadius: 99,
          background: "rgba(255,255,255,.22)", color: textColor, fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)" }}>
          {badge}
        </span>}
      </div>

      {sub && <div style={{ fontSize: 12, color: `${textColor}99`, position: "relative" }}>{sub}</div>}
      {spark && <div style={{ position: "absolute", right: 14, bottom: 12, opacity: 0.65 }}>
        <Spark values={spark} color={textColor} />
      </div>}
    </div>
  );
}

/* ── Animated Donut ── */
function DonutChart({ segments, center, label }) {
  const mounted = useMounted(300);
  const size = 140, stroke = 22, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, b) => a + (b.value || 0), 0) || 1;
  let offset = 0;
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = (seg.value || 0) / total;
          const dash = mounted ? circ * pct : 0;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, dash - 1.5)} ${circ - Math.max(0, dash - 1.5)}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: `stroke-dasharray 0.6s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.08}s`,
                filter: `drop-shadow(0 0 3px ${seg.color}55)` }} />
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

/* ── Animated Horizontal Bar ── */
function FancyBar({ label, value, max, color, pct, delay = 0 }) {
  const mounted = useMounted(250 + delay);
  const p = pct !== undefined ? pct : max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 9, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${mounted ? p : 0}%`,
          background: `linear-gradient(90deg,${color}88,${color})`,
          borderRadius: 99,
          transition: `width 0.7s cubic-bezier(0.34,1.1,0.64,1) ${delay}ms`,
          boxShadow: `0 0 8px ${color}55` }} />
      </div>
    </div>
  );
}

/* ── Timeline activity item ── */
function ActivityItem({ rec, onOpen, idx=0 }) {
  const risk = computeRisk(rec);
  const colors = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
  const c = colors[risk.band];
  return (
    <div onClick={() => onOpen(rec.hn)} className="hrow"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 6px",
        borderBottom: "1px solid var(--border)", cursor: "pointer",
        animation: `fadeUp 0.3s ease-out ${idx * 0.06}s both` }}>
      <div style={{ width: 40, height: 40, borderRadius: 12,
        background: `${c}18`, border: `2px solid ${c}44`,
        display: "grid", placeItems: "center", flexShrink: 0,
        boxShadow: `0 2px 8px ${c}22` }}>
        <span style={{ fontSize: 15 }}>{risk.band === "high" ? "🔴" : risk.band === "medium" ? "🟡" : "🟢"}</span>
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

/* ── Weekly trend area chart with draw animation ── */
function TrendMiniChart({ trend }) {
  const mounted = useMounted(400);
  const max = Math.max(...trend.values, 1);
  const w = 100, h = 44;
  const pts = trend.values.map((v, i) => {
    const x = (i / (trend.values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = trend.values.length - 1;
  const areaD = `M${trend.values.map((v,i)=>{
    const x=(i/last)*w; const y=h-(v/max)*(h-4)-2;
    return (i===0?`${x.toFixed(1)},${y.toFixed(1)}`:`L${x.toFixed(1)},${y.toFixed(1)}`);
  }).join(" ")} L${w},${h} L0,${h} Z`;
  const uid = React.useId ? React.useId() : "tg";
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`tg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#tg-${uid})`}
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s 0.4s" }} />
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        pathLength="1"
        style={{ strokeDasharray: "1", strokeDashoffset: mounted ? "0" : "1",
          transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1) 0.1s",
          filter: "drop-shadow(0 1px 4px rgba(13,148,136,.4))" }} />
      {/* Data points appear after path draws */}
      {trend.values.map((v,i)=>{
        const x=(i/last)*w; const y=h-(v/max)*(h-4)-2;
        return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--brand)"
          style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.2s ${0.8+i*0.06}s` }} />;
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────── */
/*  MAIN DASHBOARD COMPONENT                       */
/* ─────────────────────────────────────────────── */
function Dashboard({ records, user, onOpenPatient, onNew, onGoPatients }) {
  const scope  = records; // ทุก role เห็นข้อมูลผู้ป่วยทั้งหมด
  const latest = latestPerPatient(scope).map((r) => ({ ...r, risk: computeRisk(r) }));
  const mounted = useMounted(50);

  /* ── KPI ── */
  const total = latest.length;
  const riskCounts = { high: 0, medium: 0, low: 0 };
  latest.forEach((r) => riskCounts[r.risk.band]++);

  const withOutcome = scope.filter((r) => r.outcome);
  const accepted    = withOutcome.filter((r) => r.outcome === "accepted").length;
  const acceptRate  = withOutcome.length ? Math.round((accepted / withOutcome.length) * 100) : 0;

  const TODAY = todayISO();
  const due7  = isoAddDays(7);
  const dueList     = scope.filter((r) => r.followUp?.due && r.followUp.due <= due7)
    .sort((a, b) => (a.followUp.due || "").localeCompare(b.followUp.due || ""));
  const overdueList = dueList.filter((r) => r.followUp.due < TODAY);

  /* ── Weekly trend ── */
  const trend = buildTrend(scope);

  /* ── CKD stage distribution ── */
  const stageColors = { "1":"#0d9488","2":"#0284c7","3a":"#7c3aed","3b":"#d97706","4":"#ea580c","5":"#dc2626" };
  const stageData = CKD_STAGES.map((s) => ({
    label: `G${s}`, value: latest.filter((r) => r.ckdStage === s).length, color: stageColors[s] || "var(--brand)",
  })).filter((d) => d.value > 0);

  /* ── DRP breakdown ── */
  const drpCount = {};
  DRP_OPTIONS.forEach((o) => (drpCount[o.key] = 0));
  scope.forEach((r) => (r.drps || []).forEach((k) => { drpCount[k] = (drpCount[k] || 0) + 1; }));
  const drpData = DRP_OPTIONS.map((o) => ({ label: o.th, value: drpCount[o.key], color: "#7c3aed" }))
    .filter((d) => d.value > 0).sort((a,b) => b.value - a.value).slice(0, 6);
  const drpMax = drpData[0]?.value || 1;

  /* ── High-risk list ── */
  const highList = latest.filter((r) => r.risk.band !== "low").sort((a, b) => b.risk.score - a.risk.score);

  /* ── Avg eGFR ── */
  const egfrVals = latest.map((r) => parseFloat(r.egfr)).filter((v) => !isNaN(v));
  const avgEgfr  = egfrVals.length ? Math.round(egfrVals.reduce((a,b)=>a+b,0)/egfrVals.length) : 0;

  /* ── Nephrotoxic count ── */
  const nephroCount = latest.filter((r) =>
    (r.drps || []).includes("nephrotoxic") || (r.meds || []).some((m) => (m.flags||[]).includes("nephrotoxic"))
  ).length;

  /* ── DRP Resolution Rate (drpFollowup loop data) ── */
  let _drpResolved = 0, _drpOngoing = 0, _drpWorsened = 0, _drpPending = 0;
  scope.forEach((r) => {
    const fu = r.drpFollowup || {};
    (r.drps || []).forEach((key) => {
      const v = fu[key];
      if (!v) _drpPending++;
      else if (v === "resolved") _drpResolved++;
      else if (v === "ongoing") _drpOngoing++;
      else if (v === "worsened") _drpWorsened++;
      else _drpPending++;
    });
  });
  const drpFollowTotal = _drpResolved + _drpOngoing + _drpWorsened + _drpPending;
  const drpResolveRate = drpFollowTotal ? Math.round((_drpResolved / drpFollowTotal) * 100) : 0;

  /* ── Recent activity ── */
  const recentActivity = [...scope].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0, 6);

  /* ── Animated today timestamp ── */
  const [ts, setTs] = React.useState(() => new Date().toLocaleTimeString("th-TH", { hour:"2-digit", minute:"2-digit" }));
  React.useEffect(() => { const id = setInterval(() => setTs(new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})), 30000); return () => clearInterval(id); }, []);

  /* ── Empty / onboarding state — ยังไม่มีข้อมูลผู้ป่วย ── */
  if (scope.length === 0) {
    return (
      <div style={{ padding: "clamp(16px,2.2vw,28px)", maxWidth: 1380, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, animation: "fadeUp 0.35s ease-out both" }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: "linear-gradient(180deg,var(--brand),var(--brand-deep))", boxShadow: "0 2px 8px rgba(13,148,136,.5)" }} />
          <h1 style={{ fontSize: "clamp(22px,2.4vw,30px)", fontWeight: 800, color: "var(--ink)", margin: 0 }}>ภาพรวมคลินิก CKD</h1>
        </div>

        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 24, padding: "clamp(36px,6vw,72px) 24px", textAlign: "center", position: "relative", overflow: "hidden", animation: "scaleIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both" }}>
          {/* decorative gradient orbs */}
          <div className="float-anim" style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,var(--brand-soft),transparent 70%)", opacity: 0.6, pointerEvents: "none" }} />
          <div className="float-anim-2" style={{ position: "absolute", bottom: -50, left: -20, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle,#7c3aed22,transparent 70%)", opacity: 0.5, pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div className="float-anim" style={{ fontSize: 72, marginBottom: 6, filter: "drop-shadow(0 8px 16px rgba(13,148,136,.25))" }}>🩺</div>
            <h2 style={{ fontSize: "clamp(20px,2.6vw,26px)", fontWeight: 800, color: "var(--ink)", margin: "0 0 10px" }}>เริ่มต้นใช้งานคลินิก CKD</h2>
            <p style={{ fontSize: 14.5, color: "var(--ink-2)", maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.65 }}>
              ยังไม่มีข้อมูลผู้ป่วยในระบบ<br />เริ่มบันทึกการทำ Medication Reconciliation (BPML) ของผู้ป่วยรายแรกได้เลย
            </p>
            <button onClick={(e)=>{addRipple(e);onNew();}} className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "14px 30px",
                background: "linear-gradient(135deg,var(--brand),var(--brand-deep))", color: "#fff",
                border: "none", borderRadius: 14, fontSize: 15.5, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--sans)", boxShadow: "0 6px 22px rgba(13,148,136,.4)" }}>
              <Icon name="plus" size={20} color="#fff" />บันทึกผู้ป่วยรายแรก
            </button>

            <div style={{ display: "flex", justifyContent: "center", gap: "clamp(16px,4vw,44px)", marginTop: 40, flexWrap: "wrap" }}>
              {[
                { icon: "📋", title: "บันทึก BPML", desc: "เปรียบเทียบยาก่อน–หลัง" },
                { icon: "🛡️", title: "ประเมินความเสี่ยง", desc: "คัดกรอง DRP อัตโนมัติ" },
                { icon: "📅", title: "ติดตามนัด", desc: "แจ้งเตือนผู้ป่วยที่ต้องติดตาม" },
              ].map((f, i) => (
                <div key={f.title} style={{ maxWidth: 160, animation: `fadeUp 0.4s ease-out ${0.2+i*0.1}s both` }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(16px,2.2vw,28px)", maxWidth: 1380, margin: "0 auto" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 26, flexWrap: "wrap",
        animation: "fadeUp 0.35s ease-out both" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2,
              background: "linear-gradient(180deg,var(--brand),var(--brand-deep))",
              boxShadow: "0 2px 8px rgba(13,148,136,.5)" }} />
            <h1 className="head-underline" style={{ fontSize: "clamp(22px,2.4vw,30px)", fontWeight: 800, color: "var(--ink)", margin: 0, lineHeight: 1.2 }}>
              ภาพรวมคลินิก CKD
            </h1>
          </div>
          <p style={{ color: "var(--ink-2)", fontSize: 13.5, margin: "2px 0 0 14px" }}>
            ข้อมูลทั้งคลินิก · ทุกเภสัชกร
            {" · "}อัปเดต{" "}{fmtDate(TODAY)} {ts} น.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {overdueList.length > 0 && (
            <div className="risk-high-pulse"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12 }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>เกินกำหนด {overdueList.length} ราย</span>
            </div>
          )}
          <button onClick={(e)=>{addRipple(e);onNew();}}
            className="btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px",
              background: "linear-gradient(135deg,var(--brand),var(--brand-deep))", color: "#fff",
              border: "none", borderRadius: 14, fontSize: 14.5, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--sans)", boxShadow: "0 4px 18px rgba(13,148,136,.38)" }}>
            <Icon name="plus" size={18} color="#fff" />บันทึกผู้ป่วยใหม่
          </button>
        </div>
      </div>

      {/* ── ROW 1: Gradient KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 20 }}>
        <GradKpi stagger={0}
          label="ผู้ป่วยทั้งหมด" value={total} unit="ราย" icon="🏥"
          grad="linear-gradient(135deg,#0d9488 0%,#0f766e 60%,#065f46 100%)"
          sub={`eGFR เฉลี่ย ${avgEgfr || "--"} mL/min`}
          spark={trend.values}
          badge={`+${scope.filter((r)=>r.date>=monthStartISO()).length} เดือนนี้`}
          onClick={onGoPatients} />
        <GradKpi stagger={1}
          label="เสี่ยงสูง — ติดตามด่วน" value={riskCounts.high} unit="ราย" icon="🚨"
          grad="linear-gradient(135deg,#dc2626 0%,#b91c1c 55%,#7f1d1d 100%)"
          sub={`ปานกลาง ${riskCounts.medium} · ต่ำ ${riskCounts.low} ราย`}
          onClick={onGoPatients} />
        <GradKpi stagger={2}
          label="อัตราแก้ไขสำเร็จ" value={acceptRate} unit="%" icon="✅"
          grad="linear-gradient(135deg,#16a34a 0%,#15803d 55%,#14532d 100%)"
          sub={`${accepted} / ${withOutcome.length} การแทรกแซง`}
          spark={[60,65,70,68,72,acceptRate]} />
        <GradKpi stagger={3}
          label="นัดติดตาม 7 วัน" value={dueList.length} unit="ราย" icon="📅"
          grad={overdueList.length
            ? "linear-gradient(135deg,#d97706 0%,#b45309 55%,#78350f 100%)"
            : "linear-gradient(135deg,#7c3aed 0%,#6d28d9 55%,#4c1d95 100%)"}
          sub={overdueList.length ? `⚠️ เกินกำหนด ${overdueList.length} ราย` : "ทุกรายอยู่ในกำหนด"} />
        {drpFollowTotal > 0 && (
          <GradKpi stagger={4}
            label="DRP Resolution Rate" value={drpResolveRate} unit="%" icon="🔄"
            grad="linear-gradient(135deg,#0284c7 0%,#0369a1 55%,#1e3a5f 100%)"
            sub={`แก้ไขแล้ว ${_drpResolved} · ยังมี ${_drpOngoing} · แย่ลง ${_drpWorsened}`} />
        )}
      </div>

      {/* ── ROW 2: Risk + Stage + Activity ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* Risk Distribution */}
        <div className="card-modern stagger stagger-1"
          style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed22,#7c3aed44)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>🛡️</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>ระดับความเสี่ยง</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <DonutChart center={total} label="ผู้ป่วย"
              segments={[
                { value: riskCounts.high,   color: "#dc2626" },
                { value: riskCounts.medium, color: "#d97706" },
                { value: riskCounts.low,    color: "#16a34a" },
              ]} />
            <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { band:"high",   label:"เสี่ยงสูง", color:"#dc2626", bg:"#fef2f2" },
                { band:"medium", label:"ปานกลาง",   color:"#d97706", bg:"#fffbeb" },
                { band:"low",    label:"ต่ำ",        color:"#16a34a", bg:"#f0fdf4" },
              ].map(({ band, label, color, bg }, i) => {
                const n   = riskCounts[band];
                const pct = total ? Math.round((n/total)*100) : 0;
                return (
                  <div key={band} style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 11px", background: bg, borderRadius: 11,
                    animation: `slideRight 0.3s ease-out ${0.15+i*0.07}s both`,
                    border: `1px solid ${color}22` }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0,
                      boxShadow: `0 0 6px ${color}88` }} />
                    <span style={{ flex:1, fontSize:12.5, color:"var(--ink)", fontWeight:500 }}>{label}</span>
                    <span style={{ fontFamily:"var(--mono)", fontWeight:800, color, fontSize:19 }}>{n}</span>
                    <span style={{ fontSize:11, color, opacity:.75, width:32, textAlign:"right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CKD Stage + Intervention Rate */}
        <div className="card-modern stagger stagger-2"
          style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0d948822,#0d948844)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>🫘</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>CKD Stage</h3>
            <span style={{ fontSize:11.5, color:"var(--ink-2)" }}>{total} ราย</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {stageData.map((s, i) => (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:10,
                animation: `fadeUp 0.28s ease-out ${0.1+i*0.06}s both` }}>
                <span style={{ fontSize:12, fontFamily:"var(--mono)", fontWeight:700, color:s.color, width:30 }}>{s.label}</span>
                <div style={{ flex:1, height:10, borderRadius:99, background:"var(--surface-2)", overflow:"hidden" }}>
                  <div className="anim-bar" style={{ height:"100%",
                    width: `${total ? (s.value/total)*100 : 0}%`,
                    background: `linear-gradient(90deg,${s.color}77,${s.color})`,
                    borderRadius:99, boxShadow:`0 0 6px ${s.color}55`,
                    animationDelay: `${0.2+i*0.08}s`, animationDuration: "0.7s" }} />
                </div>
                <span style={{ fontFamily:"var(--mono)", fontSize:13, fontWeight:700, color:s.color, width:20, textAlign:"right" }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, color:"var(--ink-2)", marginBottom:4 }}>อัตรา Intervention สำเร็จ</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:30, fontWeight:800,
                  color: acceptRate>=70 ? "#16a34a" : "#d97706" }}>
                  {acceptRate}<span style={{ fontSize:14, fontWeight:500, color:"var(--ink-2)" }}>%</span>
                </div>
              </div>
              <Ring pct={acceptRate} color={acceptRate>=70?"#16a34a":"#d97706"} size={74} stroke={7} />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-modern stagger stagger-3"
          style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#0284c722,#0284c744)",
              display:"grid", placeItems:"center" }}>
              <span style={{ fontSize:17 }}>🕐</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>บันทึกล่าสุด</h3>
            <button onClick={onGoPatients}
              style={{ fontSize:12, color:"var(--brand-deep)", fontWeight:600, background:"none", border:"none", cursor:"pointer", fontFamily:"var(--sans)" }}>
              ดูทั้งหมด →
            </button>
          </div>
          {recentActivity.length
            ? recentActivity.map((r, i) => <ActivityItem key={r.id} rec={r} onOpen={onOpenPatient} idx={i} />)
            : <Empty text="ยังไม่มีข้อมูล" />}
        </div>
      </div>

      {/* ── DRP Resolution Detail Card (แสดงเฉพาะเมื่อมีข้อมูล drpFollowup) ── */}
      {drpFollowTotal > 0 && (
        <div className="card-modern stagger" style={{ background:"var(--surface)", borderRadius:18, padding:"20px 24px", marginBottom:16,
          display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#0284c722,#0284c744)", display:"grid", placeItems:"center" }}>
              <span style={{ fontSize:17 }}>🔄</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0 }}>DRP Resolution Tracking</h3>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
            <Ring pct={drpResolveRate} color={drpResolveRate>=70?"#16a34a":drpResolveRate>=40?"#d97706":"#dc2626"}
              size={72} stroke={7} label="แก้ไขแล้ว" />
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[
                { label:"แก้ไขแล้ว", n:_drpResolved, color:"#16a34a", bg:"#f0fdf4" },
                { label:"ยังมีอยู่",   n:_drpOngoing,  color:"#d97706", bg:"#fffbeb" },
                { label:"แย่ลง",      n:_drpWorsened, color:"#dc2626", bg:"#fef2f2" },
                { label:"รอติดตาม",   n:_drpPending,  color:"#6b7280", bg:"var(--surface-2)" },
              ].map(({ label, n, color, bg }, ci) => (
                <div key={label} className="chip-pop" style={{ padding:"10px 14px", background:bg, borderRadius:12,
                  border:`1px solid ${color}22`, minWidth:80, textAlign:"center", animationDelay:`${ci*0.07}s` }}>
                  <div style={{ fontFamily:"var(--mono)", fontSize:26, fontWeight:800, color, lineHeight:1 }}>{n}</div>
                  <div style={{ fontSize:11, color, fontWeight:600, marginTop:3 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12.5, color:"var(--ink-2)", maxWidth:220, lineHeight:1.6 }}>
              ข้อมูลจาก "ติดตามผล DRP" ใน visit ล่าสุดของแต่ละผู้ป่วย<br />
              <span style={{ color:"var(--ink)", fontWeight:600 }}>{drpFollowTotal} DRP ทั้งหมด</span> มีการ loop ติดตามผลแล้ว
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 3: DRP + Trend + Follow-up ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:16, marginBottom:16 }} className="dash-grid">

        {/* DRP Breakdown */}
        <div className="card-modern stagger stagger-4"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#7c3aed22,#7c3aed44)",
              display:"grid", placeItems:"center" }}>
              <span style={{ fontSize:17 }}>💊</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>ปัญหาด้านยา (DRP)</h3>
            <span style={{ padding:"3px 9px", background:"#7c3aed18", color:"#7c3aed", borderRadius:99,
              fontSize:11.5, fontWeight:700 }}>
              {drpData.reduce((a,b)=>a+b.value,0)} ครั้ง
            </span>
          </div>
          {drpData.length
            ? drpData.map((d, i) => (
              <FancyBar key={d.label} label={d.label} value={d.value} max={drpMax}
                color={["#7c3aed","#dc2626","#d97706","#0284c7","#16a34a","#0d9488"][i%6]}
                delay={i * 80} />
            ))
            : <Empty text="ยังไม่พบปัญหาด้านยา 🎉" />}
        </div>

        {/* Weekly Trend */}
        <div className="card-modern stagger stagger-5"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#0d948822,#0d948844)",
              display:"grid", placeItems:"center" }}>
              <span style={{ fontSize:17 }}>📈</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0 }}>แนวโน้มรายสัปดาห์</h3>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:12 }}>
            <span style={{ fontFamily:"var(--mono)", fontSize:34, fontWeight:800, color:"var(--brand)",
              textShadow:"0 2px 8px rgba(13,148,136,.25)" }}>
              {trend.values.at(-1)}
            </span>
            <span style={{ fontSize:13, color:"var(--ink-2)" }}>บันทึก สัปดาห์นี้</span>
          </div>
          <TrendMiniChart trend={trend} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            {trend.labels.map((l,i) => (
              <span key={i} style={{ fontSize:9.5, color:"var(--ink-2)", fontFamily:"var(--mono)" }}>{l}</span>
            ))}
          </div>
          <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
            {[
              ["รวมทั้งหมด", `${scope.length} records`, "var(--ink)"],
              ["ผู้ป่วยไม่ซ้ำ", `${total} ราย`, "var(--ink)"],
              ["Nephrotoxic drug", `${nephroCount} ราย`, nephroCount>0?"#dc2626":"var(--ink)"],
            ].map(([lbl,val,col])=>(
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5 }}>
                <span style={{ color:"var(--ink-2)" }}>{lbl}</span>
                <span style={{ fontFamily:"var(--mono)", fontWeight:700, color:col }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up alerts */}
        <div className="card-modern stagger stagger-6"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#0284c722,#0284c744)",
              display:"grid", placeItems:"center" }}>
              <span style={{ fontSize:17 }}>📋</span>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>นัดติดตาม</h3>
            {dueList.length>0 && (
              <span className={overdueList.length?"risk-high-pulse":""}
                style={{ padding:"3px 9px", background:"#fef2f2", color:"#dc2626", borderRadius:99,
                  fontSize:11.5, fontWeight:700 }}>{dueList.length}</span>
            )}
          </div>
          {dueList.length ? dueList.slice(0,6).map((r, i) => {
            const overdue = r.followUp.due < TODAY;
            const today   = r.followUp.due === TODAY;
            const col     = overdue ? "#dc2626" : today ? "#d97706" : "#0284c7";
            return (
              <div key={r.id} onClick={()=>onOpenPatient(r.hn)} className="hrow"
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 6px",
                  borderRadius:10, cursor:"pointer", borderBottom:"1px solid var(--border)",
                  animation:`fadeUp 0.28s ease-out ${i*0.06}s both` }}>
                <div style={{ width:5, height:38, borderRadius:3, background:col,
                  flexShrink:0, boxShadow:`0 0 8px ${col}66` }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", whiteSpace:"nowrap",
                    overflow:"hidden", textOverflow:"ellipsis" }}>{r.name}</div>
                  <div style={{ fontSize:11, color:"var(--ink-2)" }}>{r.followUp.note}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:col }}>{fmtDate(r.followUp.due)}</div>
                  {overdue && <div style={{ fontSize:10, color:"#dc2626", fontWeight:600 }}>เกินกำหนด</div>}
                  {today   && <div style={{ fontSize:10, color:"#d97706", fontWeight:600 }}>วันนี้</div>}
                </div>
              </div>
            );
          }) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              height:120, gap:8 }}>
              <span style={{ fontSize:34 }}>✅</span>
              <span style={{ fontSize:13, color:"var(--ink-2)" }}>ไม่มีนัดที่ใกล้ถึง</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Population Analytics ── */}
      <PopulationAnalytics scope={scope} records={records} />

      {/* ── SECTION HEADER: DRP & Risk Analysis ── */}
      <DRPRiskAnalysis scope={scope} onNavigate={onGoPatients} />

      {/* ── ROW 5: High-risk Table ── */}
      {highList.length > 0 && (
        <div className="card-modern stagger"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>
              ผู้ป่วยเสี่ยงสูง — ติดตามด่วน
            </h3>
            <span style={{ fontSize:12.5, padding:"4px 12px", background:"#fef2f2",
              borderRadius:99, color:"#dc2626", fontWeight:600 }}>{highList.length} ราย</span>
            <button onClick={onGoPatients}
              style={{ fontSize:12.5, color:"var(--brand-deep)", fontWeight:700, background:"none",
                border:"1px solid var(--border)", borderRadius:9, padding:"6px 12px", cursor:"pointer",
                fontFamily:"var(--sans)" }}>ดูทั้งหมด</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.2fr 1.6fr 100px", gap:12,
            padding:"0 8px 10px", fontSize:11, fontWeight:700, color:"var(--ink-2)",
            textTransform:"uppercase", letterSpacing:0.5, borderBottom:"2px solid var(--border)" }}>
            <span>ผู้ป่วย</span><span>CKD / Labs</span><span>ความเสี่ยง</span><span>ปัจจัยหลัก</span><span></span>
          </div>

          {highList.slice(0, 8).map((r, i) => (
            <div key={r.id} onClick={()=>onOpenPatient(r.hn)} className="hrow"
              style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.2fr 1.6fr 100px", gap:12,
                padding:"13px 8px", alignItems:"center", borderBottom:"1px solid var(--border)",
                cursor:"pointer",
                borderLeft:`3px solid ${r.risk.band==="high"?"#dc2626":"#d97706"}`,
                animation:`fadeUp 0.28s ease-out ${0.1+i*0.05}s both` }}>
              <div>
                <div style={{ fontWeight:700, color:"var(--ink)", fontSize:14 }}>{r.name}</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-2)", marginTop:2 }}>
                  HN {r.hn} · {r.age} ปี · {fmtDate(r.date)}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <StagePill stage={r.ckdStage} />
                <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-2)" }}>eGFR {r.egfr}</span>
                <span style={{ fontFamily:"var(--mono)", fontSize:11,
                  color:parseFloat(r.k)>5.5?"#dc2626":"var(--ink-2)" }}>K⁺ {r.k}</span>
              </div>
              <div><RiskBadge band={r.risk.band} score={r.risk.score} /></div>
              <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.5 }}>
                {r.risk.factors.slice(0,2).map((f,fi) => (
                  <div key={fi} style={{ display:"flex", alignItems:"flex-start", gap:5 }}>
                    <span style={{ color:"#dc2626", marginTop:1 }}>•</span>{f.t}
                  </div>
                ))}
              </div>
              <button className="btn-primary"
                style={{ padding:"8px 14px", background:"linear-gradient(135deg,var(--brand),var(--brand-deep))",
                  color:"#fff", border:"none", borderRadius:10, fontSize:12.5, fontWeight:700,
                  cursor:"pointer", fontFamily:"var(--sans)" }}
                onClick={(e)=>{ e.stopPropagation(); addRipple(e); onOpenPatient(r.hn); }}>ดูข้อมูล</button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

/* ── PopulationAnalytics ── */
function PopulationAnalytics({ scope }) {
  const today = todayDate();
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today); d.setMonth(d.getMonth() - i);
    monthBuckets.push({ year:d.getFullYear(), month:d.getMonth(), label:`${d.getMonth()+1}/${String(d.getFullYear()).slice(2)}` });
  }
  const egfrByMonth = monthBuckets.map(({ year, month }) => {
    const map = {};
    scope.forEach((r) => {
      if (!r.date || !r.egfr) return;
      const rd = new Date(r.date);
      if (rd.getFullYear()===year && rd.getMonth()===month) {
        if (!map[r.hn] || r.date > map[r.hn].date) map[r.hn] = r;
      }
    });
    const vals = Object.values(map).map((r)=>parseFloat(r.egfr)).filter((v)=>!isNaN(v));
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  });
  const validEgfr = egfrByMonth.filter((v)=>v!=null);
  const latestAvgEgfr = validEgfr.at(-1);
  const egfrColor = !latestAvgEgfr ? "#0d9488" : latestAvgEgfr>=60 ? "#16a34a" : latestAvgEgfr>=30 ? "#d97706" : "#dc2626";

  const hnList = [...new Set(scope.map((r)=>r.hn))];
  let rapid=0, stable=0, improving=0;
  hnList.forEach((hn) => {
    const vis = scope.filter((r)=>r.hn===hn && r.egfr && r.date).sort((a,b)=>a.date.localeCompare(b.date));
    if (vis.length<2) return;
    const slope = ((parseFloat(vis.at(-1).egfr)-parseFloat(vis[0].egfr))/((new Date(vis.at(-1).date)-new Date(vis[0].date))/86400000))*365;
    if (slope<-5) rapid++; else if (slope>2) improving++; else stable++;
  });

  if (validEgfr.length===0 && rapid+stable+improving===0) return null;

  const pts = egfrByMonth;
  const W=400, pL=44, pR=28, pT=14, pB=28, cW=W-pL-pR, cH=110-pT-pB;
  const refs = [{v:60,c:"#16a34a"},{v:30,c:"#d97706"},{v:15,c:"#dc2626"}];
  const allV = [...pts.filter(Boolean), ...refs.map((r)=>r.v)];
  const minV=Math.min(...allV)-5, maxV=Math.max(...allV)+5;
  const toY=(v)=>pT+cH-((v-minV)/(maxV-minV))*cH;
  const toX=(i)=>pL+(pts.length<=1?cW/2:(i/(pts.length-1))*cW);
  const valid = pts.map((v,i)=>({v,i})).filter((x)=>x.v!=null);
  const pathD = valid.map(({v,i},idx)=>`${idx===0?"M":"L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  const areaD = valid.length>1 ? `${pathD} L ${toX(valid.at(-1).i).toFixed(1)} ${(pT+cH).toFixed(1)} L ${toX(valid[0].i).toFixed(1)} ${(pT+cH).toFixed(1)} Z` : "";

  const mounted = useMounted(400);

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <div style={{ width:4, height:22, borderRadius:2,
          background:"linear-gradient(180deg,var(--brand),var(--brand-deep))",
          boxShadow:"0 2px 8px rgba(13,148,136,.5)" }} />
        <h2 style={{ fontSize:17, fontWeight:800, color:"var(--ink)", margin:0 }}>Population Analytics</h2>
        <span style={{ fontSize:12.5, color:"var(--ink-2)" }}>ภาพรวมระดับคลินิก</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16 }} className="dash-grid">
        {/* eGFR Trend Chart */}
        <div className="card-modern stagger stagger-2"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, color:"var(--ink-2)", marginBottom:3 }}>📊 แนวโน้ม eGFR เฉลี่ยทั้งคลินิก</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <span style={{ fontFamily:"var(--mono)", fontSize:36, fontWeight:800, color:egfrColor,
                  textShadow:`0 2px 12px ${egfrColor}44` }}>
                  {latestAvgEgfr ?? "--"}
                </span>
                <span style={{ fontSize:13, color:"var(--ink-2)" }}>mL/min เดือนล่าสุด</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {refs.map(({v,c})=>(
                <div key={v} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:c, fontWeight:700, fontFamily:"var(--mono)" }}>{v}</div>
                  <div style={{ width:24, height:2, background:c, borderRadius:1, margin:"3px auto", opacity:.7 }} />
                </div>
              ))}
            </div>
          </div>
          {validEgfr.length>0 ? (
            <svg width="100%" viewBox={`0 0 ${W} 110`} preserveAspectRatio="none"
              style={{ display:"block", overflow:"visible" }}>
              <defs>
                <linearGradient id="pa-egfr-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={egfrColor} stopOpacity=".28" />
                  <stop offset="100%" stopColor={egfrColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              {refs.map(({v,c})=>(
                <g key={v}>
                  <line x1={pL} x2={W-pR} y1={toY(v)} y2={toY(v)} stroke={c} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.55" />
                  <text x={pL-4} y={toY(v)} textAnchor="end" dominantBaseline="middle"
                    style={{ fontSize:9, fill:c, fontFamily:"monospace", fontWeight:700 }}>{v}</text>
                </g>
              ))}
              {areaD && <path d={areaD} fill="url(#pa-egfr-grad)"
                style={{ opacity:mounted?1:0, transition:"opacity 0.5s 0.4s" }} />}
              {pathD && <path d={pathD} fill="none" stroke={egfrColor} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                pathLength="1"
                style={{ strokeDasharray:"1", strokeDashoffset:mounted?"0":"1",
                  transition:"stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1) 0.2s",
                  filter:`drop-shadow(0 0 5px ${egfrColor}66)` }} />}
              {valid.map(({v,i})=>(
                <g key={i}>
                  <circle cx={toX(i)} cy={toY(v)} r="5" fill="var(--surface)" stroke={egfrColor} strokeWidth="2.5"
                    style={{ filter:`drop-shadow(0 0 3px ${egfrColor}88)`,
                      opacity:mounted?1:0, transition:`opacity 0.2s ${0.8+i*0.08}s` }} />
                  <text x={toX(i)} y={toY(v)-10} textAnchor="middle"
                    style={{ fontSize:9.5, fill:egfrColor, fontFamily:"monospace", fontWeight:700,
                      opacity:mounted?1:0, transition:`opacity 0.2s ${0.9+i*0.08}s` }}>{v}</text>
                </g>
              ))}
              {monthBuckets.map((b,i)=>(
                <text key={i} x={toX(i)} y={107} textAnchor="middle"
                  style={{ fontSize:9, fill:"var(--ink-2)", fontFamily:"monospace" }}>{b.label}</text>
              ))}
            </svg>
          ) : <Empty text="ยังไม่มีข้อมูล eGFR" />}
        </div>

        {/* CKD Progression */}
        <div className="card-modern stagger stagger-3"
          style={{ background:"var(--surface)", borderRadius:18, padding:"22px 24px" }}>
          <div style={{ fontSize:12, color:"var(--ink-2)", marginBottom:8 }}>🔬 CKD Progression</div>
          {rapid+stable+improving>0 ? (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
                <DonutChart center={rapid+stable+improving} label="ผู้ป่วย"
                  segments={[
                    {value:rapid, color:"#dc2626"},
                    {value:stable, color:"#d97706"},
                    {value:improving, color:"#16a34a"},
                  ]} />
                <div style={{ flex:1 }}>
                  {[
                    {label:"Rapid (<−5/ปี)", n:rapid, c:"#dc2626", bg:"#fef2f2"},
                    {label:"Stable", n:stable, c:"#d97706", bg:"#fffbeb"},
                    {label:"Improving", n:improving, c:"#16a34a", bg:"#f0fdf4"},
                  ].map(({label,n,c,bg},i)=>(
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8,
                      padding:"6px 10px", background:bg, borderRadius:9,
                      animation:`slideRight 0.3s ease-out ${0.2+i*0.08}s both`,
                      border:`1px solid ${c}22` }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:c,
                        boxShadow:`0 0 5px ${c}88` }} />
                      <span style={{ flex:1, fontSize:12, color:"var(--ink-2)" }}>{label}</span>
                      <span style={{ fontFamily:"var(--mono)", fontWeight:800, color:c, fontSize:16 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize:11, color:"var(--ink-2)", borderTop:"1px solid var(--border)", paddingTop:10 }}>
                คำนวณจาก slope eGFR (mL/min/ปี) ผู้ป่วยที่มี ≥2 บันทึก
              </div>
            </>
          ) : <Empty text="ต้องการ ≥2 บันทึกต่อผู้ป่วย" />}
        </div>
      </div>
    </div>
  );
}

/* ── buildTrend ── */
function buildTrend(records) {
  const end = todayDate();
  const buckets = [];
  for (let i=5;i>=0;i--) {
    const start=new Date(end); start.setDate(end.getDate()-i*7-6);
    const stop =new Date(end); stop.setDate(end.getDate()-i*7);
    buckets.push({ start, stop, n:0, label:`${stop.getDate()}/${stop.getMonth()+1}` });
  }
  records.forEach((r) => {
    const d=new Date(r.date);
    buckets.forEach((b)=>{ if(d>=b.start && d<=b.stop) b.n++; });
  });
  const base=[4,6,5,8,7,0];
  return {
    values: buckets.map((b)=>b.n),
    labels: buckets.map((b)=>b.label),
  };
}

/* ── Shared sub-components ── */
function PageHead({ title, sub, action }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, marginBottom:22, flexWrap:"wrap" }}>
      <div>
        <h1 style={{ fontSize:"clamp(20px,2.4vw,27px)", fontWeight:800, color:"var(--ink)", margin:0 }}>{title}</h1>
        {sub && <p style={{ color:"var(--ink-2)", fontSize:14, margin:"6px 0 0" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Kpi({ label, value, unit, icon, tone, sub, onClick }) {
  const tones = { danger:"#dc2626", ok:"#16a34a", warn:"#d97706" };
  const c = tones[tone] || "var(--brand)";
  return (
    <div className="card-modern" onClick={onClick}
      style={{ background:"var(--surface)", borderRadius:14, padding:"18px 20px",
        cursor:onClick?"pointer":"default", borderTop:`3px solid ${c}`, transition:"transform 0.15s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:13, color:"var(--ink-2)", fontWeight:500, lineHeight:1.3, maxWidth:130 }}>{label}</span>
        <span style={{ width:34, height:34, borderRadius:9, background:c+"18", display:"grid", placeItems:"center" }}>
          <Icon name={icon} size={18} color={c} />
        </span>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:10 }}>
        <span style={{ fontFamily:"var(--mono)", fontSize:32, fontWeight:700, color:"var(--ink)", lineHeight:1 }}>{value}</span>
        <span style={{ fontSize:14, color:"var(--ink-2)" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize:12, color:"var(--ink-2)", marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, icon, right, children }) {
  return (
    <div className="card-modern" style={{ background:"var(--surface)", borderRadius:16, padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
        {icon && <Icon name={icon} size={18} color="var(--brand-deep)" />}
        <h3 style={{ fontSize:15, fontWeight:700, color:"var(--ink)", margin:0, flex:1 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding:"26px 0", textAlign:"center", color:"var(--ink-2)", fontSize:13.5 }}>{text}</div>;
}

const primaryBtn = { display:"inline-flex", alignItems:"center", gap:8, padding:"11px 18px", background:"var(--brand)", color:"#fff", border:"none", borderRadius:11, fontSize:14.5, fontWeight:700, cursor:"pointer", fontFamily:"var(--sans)", whiteSpace:"nowrap", flexShrink:0 };
const followBtn  = { padding:"7px 12px", background:"var(--surface-2)", color:"var(--brand-deep)", border:"1px solid var(--border)", borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--sans)" };

/* =========================================================================
   DRPRiskAnalysis — Sections A–F
   ========================================================================= */
function DRPRiskAnalysis({ scope, onNavigate }) {
  const mounted = useMounted(120);

  /* ── Pre-compute per-patient latest record ── */
  const latestMap = React.useMemo(() => {
    const m = {};
    (scope || []).forEach((r) => {
      if (!m[r.hn] || (r.date || "") > (m[r.hn].date || "")) m[r.hn] = r;
    });
    return m;
  }, [scope]);
  const latestList = Object.values(latestMap);

  /* ── Section A: DRP Alert Summary ── */
  const drpAlertStats = React.useMemo(() => {
    let ddiCount = 0, doseCount = 0, contraCount = 0;
    latestList.forEach((rec) => {
      const meds = rec.meds || [];
      const egfr = rec.egfr;
      let hasDDI = false, hasDose = false, hasContra = false;
      if (meds.length >= 2) {
        const ddis = checkDDI(meds);
        if (ddis.some((d) => d.severity === "major")) hasDDI = true;
      }
      meds.forEach((m) => {
        if (!m.name) return;
        const da = checkDoseAdjustment(m.name, egfr);
        if (da) hasDose = true;
        const cc = checkContraindicated(m.name, egfr);
        if (cc && cc.level === "contraindicated") hasContra = true;
      });
      if (hasDDI) ddiCount++;
      if (hasDose) doseCount++;
      if (hasContra) contraCount++;
    });
    return { ddiCount, doseCount, contraCount };
  }, [latestList]);

  /* ── Section B: High-Risk Drug Top 5 ── */
  const topDrugs = React.useMemo(() => {
    const tally = {};
    latestList.forEach((rec) => {
      const meds = rec.meds || [];
      const egfr = rec.egfr;
      if (meds.length >= 2) {
        const ddis = checkDDI(meds);
        ddis.filter((d) => d.severity === "major").forEach((d) => {
          [d.drugA, d.drugB].forEach((name) => {
            if (!name) return;
            if (!tally[name]) tally[name] = { count: 0, types: new Set() };
            tally[name].count++;
            tally[name].types.add("DDI");
          });
        });
      }
      meds.forEach((m) => {
        if (!m.name) return;
        const da = checkDoseAdjustment(m.name, egfr);
        if (da) {
          if (!tally[m.name]) tally[m.name] = { count: 0, types: new Set() };
          tally[m.name].count++;
          tally[m.name].types.add("ปรับขนาด");
        }
        const cc = checkContraindicated(m.name, egfr);
        if (cc && cc.level === "contraindicated") {
          if (!tally[m.name]) tally[m.name] = { count: 0, types: new Set() };
          tally[m.name].count++;
          tally[m.name].types.add("ห้ามใช้");
        }
      });
    });
    return Object.entries(tally)
      .map(([name, { count, types }]) => ({ name, count, types: [...types] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [latestList]);

  /* ── Section C: eGFR Progression Matrix ── */
  const egfrMatrix = React.useMemo(() => {
    const byHn = {};
    (scope || []).forEach((r) => {
      if (!byHn[r.hn]) byHn[r.hn] = [];
      byHn[r.hn].push(r);
    });
    return Object.entries(byHn).map(([hn, recs]) => {
      const sorted = [...recs].filter((r) => r.date && r.egfr).sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted.at(-1);
      if (!latest) return null;
      if (sorted.length < 2) {
        return { hn, name: latest.name, egfr: latest.egfr, trend: "ข้อมูลไม่พอ", slope: null };
      }
      const prev = sorted.at(-2);
      const daysDiff = (new Date(latest.date) - new Date(prev.date)) / 86400000;
      const months = daysDiff / 30.44;
      const slope = months > 0 ? (parseFloat(latest.egfr) - parseFloat(prev.egfr)) / months : 0;
      let trend = "คงที่";
      if (slope > 1) trend = "ดีขึ้น";
      else if (slope < -1) trend = "แย่ลง";
      return { hn, name: latest.name, egfr: latest.egfr, trend, slope: Math.round(slope * 10) / 10 };
    }).filter(Boolean);
  }, [scope]);

  /* ── Section D: Polypharmacy ── */
  const polypharmacy = React.useMemo(() => {
    const poly = latestList.filter((r) => (r.meds || []).length >= 5);
    const pct = latestList.length ? Math.round((poly.length / latestList.length) * 100) : 0;
    return { poly, pct, total: latestList.length };
  }, [latestList]);

  /* ── Section E: Electrolyte Watch ── */
  const electrolyteWatch = React.useMemo(() => {
    const hyperK = [], acidosis = [], both = [];
    latestList.forEach((r) => {
      const k = parseFloat(r.k);
      const hco3 = parseFloat(r.hco3);
      const isHyperK = !isNaN(k) && k > 5.5;
      const isAcidosis = !isNaN(hco3) && hco3 < 18;
      if (isHyperK && isAcidosis) both.push(r.name || r.hn);
      else if (isHyperK) hyperK.push(r.name || r.hn);
      else if (isAcidosis) acidosis.push(r.name || r.hn);
    });
    return { hyperK, acidosis, both };
  }, [latestList]);
  const hasCritical = electrolyteWatch.hyperK.length + electrolyteWatch.acidosis.length + electrolyteWatch.both.length > 0;

  /* ── Section F: Monthly Visit Volume ── */
  const monthlyVolume = React.useMemo(() => {
    const today = todayDate();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ key, label: TH_MONTHS[d.getMonth()], count: 0, isCurrent: i === 0 });
    }
    (scope || []).forEach((r) => {
      if (!r.date) return;
      const key = r.date.slice(0, 7);
      const b = buckets.find((bk) => bk.key === key);
      if (b) b.count++;
    });
    return buckets;
  }, [scope]);
  const maxVolume = Math.max(...monthlyVolume.map((b) => b.count), 1);

  const trendColors = {
    "ดีขึ้น": "#16a34a",
    "คงที่": "#6b7280",
    "แย่ลง": "#dc2626",
    "ข้อมูลไม่พอ": "#9ca3af",
  };
  const trendArrow = { "ดีขึ้น": "↑", "คงที่": "→", "แย่ลง": "↓", "ข้อมูลไม่พอ": "?" };

  /* ── Badge colors for Section B ── */
  const typeBadgeColor = { "DDI": "#dc2626", "ห้ามใช้": "#ea580c", "ปรับขนาด": "#d97706" };
  const topMax = topDrugs[0]?.count || 1;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes pulseRed { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes barGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes countUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideLeft { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes scaleInChip { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUpRow { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes svgBarGrow { from{height:0;y:calc(100% - 0px)} to{} }
      `}</style>

      {/* ── Section Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2,
          background: "linear-gradient(180deg,#dc2626,#d97706)",
          boxShadow: "0 2px 8px rgba(220,38,38,.4)" }} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", margin: 0 }}>📊 วิเคราะห์ DRP & ความเสี่ยง</h2>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Drug-related problems & Clinical risk analytics</span>
      </div>

      {/* ── Row A+B: DRP Alert Summary + High-Risk Drugs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* A: DRP Alert Summary Card */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#dc262622,#dc262644)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>🚨</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>DRP Alert Summary</h3>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "DDI Major", count: drpAlertStats.ddiCount, color: "#dc2626", bg: "#fef2f2", unit: "ราย" },
              { label: "ปรับขนาด", count: drpAlertStats.doseCount, color: "#d97706", bg: "#fffbeb", unit: "ราย" },
              { label: "ห้ามใช้", count: drpAlertStats.contraCount, color: "#ea580c", bg: "#fff7ed", unit: "ราย" },
            ].map(({ label, count, color, bg, unit }, i) => {
              const animCount = useCounter(mounted ? count : 0, 900);
              return (
                <div key={label} onClick={() => onNavigate && onNavigate()}
                  style={{ flex: 1, minWidth: 90, padding: "14px 16px", background: bg,
                    border: `1.5px solid ${color}33`, borderRadius: 14, cursor: "pointer",
                    animation: `scaleInChip 0.4s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.09}s both`,
                    transition: "transform 0.15s, box-shadow 0.15s",
                    boxShadow: `0 2px 10px ${color}18` }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 18px ${color}33`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 2px 10px ${color}18`; }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 800, color, lineHeight: 1,
                    animation: `countUp 0.5s ease-out ${0.2 + i * 0.09}s both` }}>{animCount}</div>
                  <div style={{ fontSize: 11.5, color, fontWeight: 700, marginTop: 4 }}>{label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>{unit}</div>
                </div>
              );
            })}
          </div>
          {latestList.length === 0 && <Empty text="ยังไม่มีข้อมูล" />}
        </div>

        {/* B: High-Risk Drug Top 5 */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#d9770622,#d9770644)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>💊</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>ยาเสี่ยงสูง Top 5</h3>
          </div>
          {topDrugs.length ? topDrugs.map((drug, i) => {
            const barPct = Math.round((drug.count / topMax) * 100);
            return (
              <div key={drug.name} style={{ marginBottom: 11,
                animation: `slideLeft 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.07}s both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drug.name}</span>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
                    {drug.types.map((t) => (
                      <span key={t} style={{ fontSize: 9.5, fontWeight: 700, color: "#fff",
                        background: typeBadgeColor[t] || "#6b7280", padding: "2px 6px",
                        borderRadius: 99 }}>{t}</span>
                    ))}
                    <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700,
                      color: "#dc2626", marginLeft: 4 }}>{drug.count}</span>
                  </div>
                </div>
                <div style={{ height: 9, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden",
                  transformOrigin: "left" }}>
                  <div style={{ height: "100%",
                    width: `${mounted ? barPct : 0}%`,
                    background: `linear-gradient(90deg,#dc262688,#dc2626)`,
                    borderRadius: 99,
                    transition: `width 0.65s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.07 + 0.15}s`,
                    boxShadow: "0 0 8px #dc262655" }} />
                </div>
              </div>
            );
          }) : <Empty text="ยังไม่พบยาเสี่ยงสูง 🎉" />}
        </div>
      </div>

      {/* ── Row C+D: eGFR Matrix + Polypharmacy ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* C: eGFR Progression Matrix */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0d948822,#0d948844)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>📉</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>eGFR Progression Matrix</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{egfrMatrix.length} ราย</span>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
            {egfrMatrix.length ? egfrMatrix.map((row, i) => {
              const col = trendColors[row.trend] || "#9ca3af";
              const arrow = trendArrow[row.trend] || "?";
              return (
                <div key={row.hn} onClick={() => onNavigate && onNavigate()} className="hrow"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px",
                    borderBottom: "1px solid var(--border)", cursor: "pointer", borderLeft: `3px solid ${col}`,
                    animation: `fadeUpRow 0.3s ease-out ${i * 0.05}s both` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${col}18`,
                    display: "grid", placeItems: "center", flexShrink: 0, fontSize: 16, color: col, fontWeight: 700 }}>
                    {arrow}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>HN {row.hn}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 15, fontWeight: 700, color: col }}>
                      {row.egfr}
                    </div>
                    <div style={{ fontSize: 10.5, color: col, fontWeight: 600 }}>
                      {row.trend}{row.slope !== null ? ` (${row.slope > 0 ? "+" : ""}${row.slope}/mo)` : ""}
                    </div>
                  </div>
                </div>
              );
            }) : <Empty text="ยังไม่มีข้อมูลการติดตาม" />}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {[["ดีขึ้น","#16a34a","↑"],["คงที่","#6b7280","→"],["แย่ลง","#dc2626","↓"],["ข้อมูลไม่พอ","#9ca3af","?"]].map(([label,color,icon]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <span style={{ color, fontWeight: 700 }}>{icon}</span>
                <span style={{ color: "var(--ink-2)" }}>{label}: {egfrMatrix.filter((r)=>r.trend===label).length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* D: Polypharmacy Alert */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed22,#7c3aed44)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>💊</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Polypharmacy Alert</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <DonutChart
              center={polypharmacy.poly.length}
              label="poly"
              segments={[
                { value: polypharmacy.poly.length, color: "#7c3aed" },
                { value: Math.max(0, polypharmacy.total - polypharmacy.poly.length), color: "var(--border)" },
              ]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 34, fontWeight: 800, color: "#7c3aed", lineHeight: 1,
                animation: mounted ? `countUp 0.5s ease-out both` : undefined }}>
                {polypharmacy.pct}<span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink-2)" }}>%</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>
                {polypharmacy.poly.length} / {polypharmacy.total} ราย<br />
                <span style={{ fontWeight: 600, color: "#7c3aed" }}>(≥5 รายการยา)</span>
              </div>
            </div>
          </div>
          {polypharmacy.poly.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 90, overflowY: "auto" }}>
              {polypharmacy.poly.map((r, i) => (
                <span key={r.hn} style={{ fontSize: 11.5, padding: "3px 10px", background: "#7c3aed18",
                  color: "#7c3aed", borderRadius: 99, fontWeight: 600,
                  animation: `scaleInChip 0.35s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.05}s both` }}>
                  {r.name || r.hn}
                </span>
              ))}
            </div>
          )}
          {polypharmacy.poly.length === 0 && <Empty text="ไม่พบ Polypharmacy 🎉" />}
        </div>
      </div>

      {/* ── Row E+F: Electrolyte Watch + Monthly Volume ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 16, marginBottom: 16 }} className="dash-grid">

        {/* E: Electrolyte Watch */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#dc262622,#dc262644)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>⚡</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>Electrolyte Watch</h3>
            {hasCritical && (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626",
                animation: "pulseRed 1.2s ease-in-out infinite",
                boxShadow: "0 0 6px #dc2626" }} />
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Hyperkalemia", sub: "K⁺ > 5.5", count: electrolyteWatch.hyperK.length + electrolyteWatch.both.length, color: "#dc2626", bg: "#fef2f2" },
              { label: "Acidosis", sub: "HCO₃ < 18", count: electrolyteWatch.acidosis.length + electrolyteWatch.both.length, color: "#d97706", bg: "#fffbeb" },
            ].map(({ label, sub, count, color, bg }, i) => {
              const animCount = useCounter(mounted ? count : 0, 800);
              return (
                <div key={label} style={{ flex: 1, padding: "12px 14px", background: bg,
                  border: `1.5px solid ${color}33`, borderRadius: 12,
                  animation: `scaleInChip 0.4s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.08}s both` }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{animCount}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color, marginTop: 3 }}>{label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{sub}</div>
                </div>
              );
            })}
          </div>
          {electrolyteWatch.both.length > 0 && (
            <div style={{ padding: "8px 12px", background: "#fef2f2", borderRadius: 10, marginBottom: 10,
              border: "1.5px solid #fca5a5" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                ⚠️ ทั้ง 2 ภาวะ ({electrolyteWatch.both.length} ราย)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {electrolyteWatch.both.map((name, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "2px 8px", background: "#dc262618",
                    color: "#dc2626", borderRadius: 99 }}>{name}</span>
                ))}
              </div>
            </div>
          )}
          {[
            { list: electrolyteWatch.hyperK, label: "K⁺ สูง", color: "#dc2626" },
            { list: electrolyteWatch.acidosis, label: "Acidosis", color: "#d97706" },
          ].map(({ list, label, color }) => list.length > 0 && (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 4, fontWeight: 600 }}>{label}:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {list.map((name, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "2px 8px", background: `${color}18`,
                    color, borderRadius: 99 }}>{name}</span>
                ))}
              </div>
            </div>
          ))}
          {!hasCritical && <Empty text="ค่าเกลือแร่ปกติทุกราย ✅" />}
        </div>

        {/* F: Monthly Visit Volume */}
        <div className="card-modern" style={{ background: "var(--surface)", borderRadius: 18, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0284c722,#0284c744)",
              display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17 }}>📆</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>ปริมาณการเยี่ยมรายเดือน</h3>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            {/* SVG Bar Chart */}
            <svg viewBox="0 0 360 130" style={{ flex: 1, display: "block", overflow: "visible" }}>
              {/* Y-axis reference lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = 110 - frac * 90;
                const val = Math.round(frac * maxVolume);
                return (
                  <g key={frac}>
                    <line x1="32" x2="356" y1={y} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.6" />
                    <text x="28" y={y + 3} textAnchor="end"
                      style={{ fontSize: 8, fill: "var(--ink-2)", fontFamily: "monospace" }}>{val}</text>
                  </g>
                );
              })}
              {/* Bars */}
              {monthlyVolume.map((b, i) => {
                const barW = 40, gap = 12;
                const x = 36 + i * (barW + gap);
                const barH = maxVolume > 0 ? Math.max(4, (b.count / maxVolume) * 90) : 4;
                const y = 110 - (mounted ? barH : 0);
                const color = b.isCurrent ? "var(--brand)" : "#0d948855";
                return (
                  <g key={b.key}>
                    <rect x={x} y={mounted ? y : 110} width={barW} height={mounted ? barH : 0} rx="5"
                      fill={color}
                      style={{ transition: `y 0.7s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.07}s, height 0.7s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.07}s`,
                        filter: b.isCurrent ? "drop-shadow(0 0 6px rgba(13,148,136,.5))" : "none" }} />
                    {b.count > 0 && (
                      <text x={x + barW / 2} y={mounted ? y - 4 : 106} textAnchor="middle"
                        style={{ fontSize: 9.5, fill: b.isCurrent ? "var(--brand-deep)" : "var(--ink-2)",
                          fontFamily: "monospace", fontWeight: 700,
                          transition: `y 0.7s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.07}s` }}>
                        {b.count}
                      </text>
                    )}
                    <text x={x + barW / 2} y={124} textAnchor="middle"
                      style={{ fontSize: 9.5, fill: b.isCurrent ? "var(--brand-deep)" : "var(--ink-2)",
                        fontFamily: "monospace", fontWeight: b.isCurrent ? 700 : 400 }}>
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
              รวม 6 เดือน: <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>
                {monthlyVolume.reduce((a, b) => a + b.count, 0)}
              </span> บันทึก
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <div style={{ width: 12, height: 8, borderRadius: 2, background: "var(--brand)" }} />
                <span style={{ color: "var(--ink-2)" }}>เดือนปัจจุบัน</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <div style={{ width: 12, height: 8, borderRadius: 2, background: "#0d948855" }} />
                <span style={{ color: "var(--ink-2)" }}>เดือนก่อน</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, PageHead, Kpi, Card, Empty, primaryBtn, followBtn, latestPerPatient, PopulationAnalytics, DRPRiskAnalysis, useCounter, useMounted, addRipple });
