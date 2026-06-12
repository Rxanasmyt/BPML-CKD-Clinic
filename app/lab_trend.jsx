/* =========================================================================
   lab_trend.jsx — แสดงแนวโน้มผลแล็บ + ประวัติยา/DRP ของ visit ก่อนหน้า
   - MultiLabTrend: sparkline หลายค่า (eGFR, Cr, K, Hb, HCO3, Phos)
   - PrevVisitPanel: รวม trend + การเปลี่ยนแปลงยา + DRP ก่อนหน้า + ปุ่มคัดลอก
   ใช้ของเดิม: diffMedLists, drpLabel, fmtDate (window globals)
   ========================================================================= */

/* ---------- นิยามค่าแล็บที่ติดตาม ----------
   field = key ใน record ; better: "up"|"down" = ทิศที่ "ดีขึ้น" (improving) */
const LAB_SERIES = [
  { field: "egfr", label: "eGFR", unit: "mL/min", better: "up",   prec: 0 },
  { field: "scr",  label: "Cr",   unit: "mg/dL",  better: "down", prec: 2 },
  { field: "k",    label: "K⁺",   unit: "mmol/L", better: null,   prec: 1 },
  { field: "hb",   label: "Hb",   unit: "g/dL",   better: "up",   prec: 1 },
  { field: "hco3", label: "HCO₃⁻",unit: "mEq/L",  better: "up",   prec: 0 },
  { field: "phos", label: "PO₄",  unit: "mmol/L", better: "down", prec: 1 },
];

// สร้างชุดข้อมูล (visit ก่อนหน้า ≤5 + ค่าปัจจุบัน) สำหรับ field หนึ่ง
function seriesFor(field, priorVisits, current) {
  const pts = [];
  priorVisits.forEach((r) => {
    const v = parseFloat(r[field]);
    if (!isNaN(v)) pts.push({ date: r.date, v, current: false });
  });
  const cv = current ? parseFloat(current[field]) : NaN;
  if (!isNaN(cv)) pts.push({ date: "ปัจจุบัน", v: cv, current: true });
  return pts;
}

// MiniSpark — เส้นกราฟ SVG เล็ก ๆ สำหรับ 1 ค่าแล็บ
function MiniSpark({ pts, color }) {
  const W = 78, H = 26, PAD = 3;
  if (pts.length < 2) {
    return <span style={{ fontSize: 10, color: "var(--ink-2)" }}>{pts.length === 1 ? "จุดเดียว" : "—"}</span>;
  }
  const vals = pts.map((p) => p.v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const xy = pts.map((p, i) => ({
    x: PAD + (i / (pts.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (p.v - minV) / range) * (H - PAD * 2),
    current: p.current,
  }));
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <polyline className="spark-draw" pathLength={1} points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {xy.map((p, i) => (
        <circle key={i} className="spark-dot" cx={p.x} cy={p.y} r={p.current ? 3 : 2}
          fill={p.current ? color : "var(--surface)"} stroke={color} strokeWidth={1.2} />
      ))}
    </svg>
  );
}

/* ---------- MultiLabTrend — ตารางแนวโน้มผลแล็บหลายค่า ---------- */
function MultiLabTrend({ priorVisits, current }) {
  // เรียงเก่า→ใหม่ และจำกัด ≤5 visit ล่าสุด
  const visits = React.useMemo(() => {
    return [...(priorVisits || [])]
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(-5);
  }, [priorVisits]);

  const rows = LAB_SERIES.map((s) => {
    const pts = seriesFor(s.field, visits, current);
    if (pts.length === 0) return null;
    const latest = pts[pts.length - 1];
    const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
    let delta = null, deltaColor = "var(--ink-2)", arrow = "→";
    if (prev) {
      const d = latest.v - prev.v;
      const rounded = Math.round(d * 100) / 100;
      if (Math.abs(rounded) < (s.prec === 0 ? 1 : Math.pow(10, -s.prec) * 5)) {
        arrow = "→"; deltaColor = "var(--ink-2)";
      } else {
        const rising = rounded > 0;
        arrow = rising ? "▲" : "▼";
        if (s.better === null) deltaColor = "#64748b";
        else {
          const improving = (s.better === "up" && rising) || (s.better === "down" && !rising);
          deltaColor = improving ? "#16a34a" : "#dc2626";
        }
      }
      delta = (rounded > 0 ? "+" : "") + rounded;
    }
    return { s, pts, latest, delta, deltaColor, arrow };
  }).filter(Boolean);

  if (!rows.length) {
    return <div style={{ fontSize: 12, color: "var(--ink-2)", padding: "8px 2px" }}>ยังไม่มีข้อมูลผลแล็บที่จะแสดงแนวโน้ม</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
      {rows.map(({ s, pts, latest, delta, deltaColor, arrow }) => (
        <div key={s.field} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>{s.label}</span>
            <span style={{ fontSize: 14.5, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--ink)" }}>
              {Math.round(latest.v * Math.pow(10, s.prec)) / Math.pow(10, s.prec)}
            </span>
            <span style={{ fontSize: 9.5, color: "var(--ink-2)" }}>{s.unit}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <MiniSpark pts={pts} color={deltaColor === "var(--ink-2)" ? "var(--brand)" : deltaColor} />
            {delta != null && (
              <span style={{ fontSize: 11, fontWeight: 800, color: deltaColor, whiteSpace: "nowrap" }}>
                {arrow} {delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- chip ยา (สี) ---------- */
function MedChip({ text, tone }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: tone + "18", color: tone, border: `1px solid ${tone}40`, lineHeight: 1.3 }}>
      {text}
    </span>
  );
}

/* ---------- PrevVisitPanel — แผงรวมประวัติ visit ก่อนหน้า ---------- */
function PrevVisitPanel({ priorVisits, current, onOneTapCopy }) {
  const [open, setOpen] = React.useState(true);
  if (!priorVisits || !priorVisits.length) return null;

  // เรียงใหม่→เก่า เพื่อหา latest
  const sorted = React.useMemo(() =>
    [...priorVisits].sort((a, b) => (b.date || "").localeCompare(a.date || "")), [priorVisits]);
  const last = sorted[0];

  // med reconciliation diff: prev(last) → current
  const diff = React.useMemo(() => {
    if (typeof window.diffMedLists !== "function") return null;
    return window.diffMedLists(last.meds || [], current.meds || []);
  }, [last, current.meds]);

  // ยาเดิม (อยู่ทั้ง 2 นัด/ unchanged+changed) — แสดงจาก current ที่ตรงกับ prev
  const prevDrugKeys = new Set((last.meds || []).filter((m) => m && m.drug).map((m) => m.drug.trim().toLowerCase()));
  const curContinued = (current.meds || []).filter((m) => m && m.drug && prevDrugKeys.has(m.drug.trim().toLowerCase()));

  // DRP ก่อนหน้า — รวม drps[] + drpFindings[].drpKey
  const prevDrpKeys = React.useMemo(() => {
    const keys = new Set([...(last.drps || [])]);
    (last.drpFindings || []).forEach((f) => { if (f && f.drpKey) keys.add(f.drpKey); });
    return [...keys];
  }, [last]);

  const lbl = (k) => (typeof window.drpLabel === "function" ? window.drpLabel(k) : k);
  const fmt = (d) => (typeof window.fmtDate === "function" ? window.fmtDate(d) : d);

  return (
    <div style={{ marginBottom: 14, border: "1.5px solid var(--brand)", borderRadius: 14, overflow: "hidden", background: "var(--surface)", boxShadow: "0 4px 18px rgba(13,148,136,.12)", animation: "fadeUp 0.3s ease-out both" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "var(--brand-soft)", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
        <span style={{ fontSize: 16, width: 30, height: 30, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>📈</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: "var(--brand-deep)" }}>ประวัติ / แนวโน้มจาก visit ก่อนหน้า</span>
          <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{priorVisits.length} visit · ล่าสุด {fmt(last.date)}</span>
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--brand-deep)", flexShrink: 0 }}><Icon name="chevron" size={18} /></span>
      </button>

      {open && (
        <div style={{ padding: "14px 18px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* one-tap copy */}
          {onOneTapCopy && (last.meds || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "10px 12px", background: "#fff7ed", border: "1px solid #f59e0b", borderRadius: 10 }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: "#92400e" }}>
                คัดลอกยา + lab + การแพ้ + OTC จาก visit ล่าสุดมาทั้งชุด แล้วแก้เฉพาะที่เปลี่ยน
              </span>
              <button type="button" onClick={() => onOneTapCopy(last)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" }}>
                ⚡ ใช้ข้อมูล visit ก่อนหน้า (แก้ไขภายหลังได้)
              </button>
            </div>
          )}

          {/* A) Lab trend */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>📊 แนวโน้มผลแล็บ <span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 11 }}>(สีเขียว = ดีขึ้น, แดง = แย่ลง)</span></div>
            <MultiLabTrend priorVisits={priorVisits} current={current} />
          </div>

          {/* B) Med changes */}
          {diff && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>💊 การเปลี่ยนแปลงรายการยา <span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 11 }}>(เทียบนัด {fmt(last.date)})</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {curContinued.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", minWidth: 88 }}>ยาเดิม ({curContinued.length})</span>
                    {curContinued.map((m, i) => <MedChip key={"k" + i} text={`${m.drug}${m.strength ? " " + m.strength : ""}`} tone="#2563eb" />)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", minWidth: 88 }}>ยาใหม่ในรอบนี้ ({diff.added.length})</span>
                  {diff.added.length ? diff.added.map((m, i) => <MedChip key={"a" + i} text={`${m.drug}${m.strength ? " " + m.strength : ""}`} tone="#16a34a" />)
                    : <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>—</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", minWidth: 88 }}>ยาที่หยุด ({diff.stopped.length})</span>
                  {diff.stopped.length ? diff.stopped.map((m, i) => <MedChip key={"s" + i} text={`${m.drug}${m.strength ? " " + m.strength : ""}`} tone="#dc2626" />)
                    : <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>—</span>}
                </div>
                {diff.changed.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", minWidth: 88 }}>เปลี่ยนขนาด ({diff.changed.length})</span>
                    {diff.changed.map((c, i) => <MedChip key={"c" + i} text={`${c.drug}: ${c.from || "–"} → ${c.to || "–"}`} tone="#d97706" />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C) Previous DRPs */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>🩺 DRP ที่เคยพบในนัดก่อน <span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 11 }}>(ตรวจว่าแก้ไขแล้วหรือยัง)</span></div>
            {prevDrpKeys.length ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {prevDrpKeys.map((k) => (
                  <span key={k} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" }}>{lbl(k)}</span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>ไม่มี DRP บันทึกไว้ในนัดก่อน</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { MultiLabTrend, PrevVisitPanel, LAB_SERIES });
