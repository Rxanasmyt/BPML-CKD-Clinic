/* =========================================================================
   patients.jsx — รายชื่อผู้ป่วย (ค้นหา/กรอง/จัดลำดับเสี่ยง) + รายละเอียด/ประวัติ
   ========================================================================= */
function PatientsList({ records, user, onOpenPatient, onNew }) {
  const [q, setQ] = React.useState("");
  const [riskF, setRiskF] = React.useState("all");
  const [sort, setSort] = React.useState("risk");

  const scope = user.role === "admin" ? records : records.filter((r) => r.createdBy === user.id);
  let rows = latestPerPatient(scope).map((r) => ({ ...r, risk: computeRisk(r) }));

  if (q.trim()) { const s = q.trim().toLowerCase(); rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.hn || "").includes(s)); }
  if (riskF !== "all") rows = rows.filter((r) => r.risk.band === riskF);
  rows.sort((a, b) => sort === "risk" ? b.risk.score - a.risk.score : (b.date || "").localeCompare(a.date || ""));

  const counts = { all: latestPerPatient(scope).length };

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1280, margin: "0 auto" }}>
      <PageHead title="ผู้ป่วยทั้งหมด" sub={`${rows.length} ราย`}
        action={<button onClick={onNew} style={primaryBtn}><Icon name="plus" size={18} color="#fff" />บันทึกผู้ป่วยใหม่</button>} />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="search" size={17} color="var(--ink-2)" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาด้วยชื่อ หรือ HN"
            style={{ ...inS, paddingLeft: 38, height: 42 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "ทั้งหมด"], ["high", "เสี่ยงสูง"], ["medium", "ปานกลาง"], ["low", "ต่ำ"]].map(([k, t]) => (
            <button key={k} onClick={() => setRiskF(k)} style={segBtn2(riskF === k, k)}>{t}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...inS, width: "auto", height: 42, cursor: "pointer" }}>
          <option value="risk">เรียงตามความเสี่ยง</option>
          <option value="date">เรียงตามวันที่ล่าสุด</option>
        </select>
      </div>

      <div className="ptbl-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div className="ptbl-head" style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.1fr 1.4fr 1fr 40px", gap: 12, padding: "12px 18px", fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
          <span>ผู้ป่วย</span><span>ระยะ CKD</span><span>ค่าแล็บ</span><span>ความเสี่ยง</span><span>บันทึกล่าสุด</span><span></span>
        </div>
        {rows.length ? rows.map((r) => (
          <div key={r.id} onClick={() => onOpenPatient(r.hn)} className="prow"
            style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.1fr 1.4fr 1fr 40px", gap: 12, padding: "13px 18px", alignItems: "center", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
            <div>
              <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14.5 }}>{r.name}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-2)" }}>HN {r.hn} · {r.age} ปี</div>
            </div>
            <div><StagePill stage={r.ckdStage} /></div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
              eGFR {r.egfr || "–"}<br />K⁺ {r.k || "–"}
            </div>
            <div><RiskBadge band={r.risk.band} score={r.risk.score} />
              {r.followUp && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11.5, color: "#d97706" }}><Icon name="clock" size={12} color="#d97706" />นัด {fmtDate(r.followUp.due)}</div>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{fmtDate(r.date)}</div>
            <Icon name="chevronR" size={16} color="var(--ink-2)" />
          </div>
        )) : <Empty text="ไม่พบผู้ป่วยตามเงื่อนไข" />}
      </div>
    </div>
  );
}

/* ---------- TrendPanel + VisitCompareTable ---------- */
const METRICS = [
  { key: "egfr",  label: "eGFR",  unit: "mL/min", color: "var(--brand)", good: "high", warnLow: 30, dangerLow: 15 },
  { key: "k",     label: "K⁺",    unit: "mmol/L", color: "#7c3aed",      good: "normal", warnHigh: 5.5, warnLow: 3.5, dangerHigh: 6.0, dangerLow: 3.0 },
  { key: "scr",   label: "Scr",   unit: "mg/dL",  color: "#0e7490",      good: "low" },
  { key: "bpSys", label: "BP ตัวบน", unit: "mmHg", color: "#dc2626",   good: "low", warnHigh: 140, dangerHigh: 160 },
];

function metricColor(m, v) {
  if (!v || isNaN(v)) return "var(--ink-2)";
  if (m.dangerHigh && v >= m.dangerHigh) return "#dc2626";
  if (m.dangerLow  && v <= m.dangerLow)  return "#dc2626";
  if (m.warnHigh   && v > m.warnHigh)    return "#d97706";
  if (m.warnLow    && v < m.warnLow)     return "#d97706";
  return "#16a34a";
}

function TrendPanel({ history, onSelectVisit }) {
  const chrono = [...history].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels  = chrono.map((r) => fmtDate(r.date));

  return (
    <div>
      {/* Mini trend charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 16 }}>
        {METRICS.map((m) => {
          const vals = chrono.map((r) => parseFloat(r[m.key]) || null);
          const valid = vals.filter(Boolean);
          if (valid.length < 1) return null;
          const last = valid[valid.length - 1];
          const prev = valid[valid.length - 2];
          const delta = prev != null ? last - prev : null;
          const c = metricColor(m, last);
          const goodUp = m.good === "high";
          const arrowColor = delta == null ? "var(--ink-2)" : (goodUp ? (delta >= 0 ? "#16a34a" : "#dc2626") : (delta <= 0 ? "#16a34a" : "#dc2626"));
          return (
            <div key={m.key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>{m.label} <span style={{ fontWeight: 400 }}>({m.unit})</span></span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700, color: c }}>{last}</span>
                  {delta != null && <span style={{ fontSize: 12, color: arrowColor, marginLeft: 7, fontWeight: 700 }}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{delta !== 0 ? Math.abs(delta).toFixed(1) : ""}</span>}
                </div>
              </div>
              <LineChart points={vals.filter(Boolean)} labels={labels.slice(-valid.length)} height={90} color={m.color} />
            </div>
          );
        })}
      </div>

      {/* Visit comparison table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="list" size={16} color="var(--brand-deep)" />
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", margin: 0 }}>เปรียบเทียบทุก Visit ({chrono.length} ครั้ง)</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={th}>วันที่</th>
                <th style={th}>CKD</th>
                {METRICS.map((m) => <th key={m.key} style={th}>{m.label}<br /><span style={{ fontWeight:400,fontSize:10.5,color:"var(--ink-2)" }}>({m.unit})</span></th>)}
                <th style={th}>DRP</th>
                <th style={th}>ความเสี่ยง</th>
                <th style={th}>เภสัชกร</th>
                <th style={{ ...th, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {chrono.slice().reverse().map((r, i) => {
                const rk = computeRisk(r);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: i === 0 ? "var(--brand-soft)" : "transparent" }}>
                    <td style={td}><span style={{ fontWeight: 600, color: "var(--ink)" }}>{fmtDate(r.date)}</span>{i === 0 && <span style={{ display: "block", fontSize: 10.5, color: "var(--brand-deep)", fontWeight: 600 }}>ล่าสุด</span>}</td>
                    <td style={{ ...td, textAlign: "center" }}><StagePill stage={r.ckdStage} /></td>
                    {METRICS.map((m) => {
                      const v = parseFloat(r[m.key]);
                      const c = metricColor(m, v);
                      return <td key={m.key} style={{ ...td, textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, color: c }}>{r[m.key] || "–"}</td>;
                    })}
                    <td style={{ ...td, textAlign: "center" }}>
                      {(r.drps||[]).length > 0 ? <span style={{ color: "#dc2626", fontWeight: 700 }}>{(r.drps||[]).length}</span> : <span style={{ color: "var(--ink-2)" }}>–</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><RiskBadge band={rk.band} score={rk.score} small /></td>
                    <td style={{ ...td, fontSize: 12, color: "var(--ink-2)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pharmacist || "–"}</td>
                    <td style={td}>
                      <button onClick={() => onSelectVisit(r.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--brand-deep)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>ดู</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--ink-2)", fontSize: 12, textTransform: "uppercase", letterSpacing: .3, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const td = { padding: "11px 12px", verticalAlign: "middle" };
const ghostBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" };

/* ---------- รายละเอียด + ประวัติ ---------- */
function PatientDetail({ hn, records, user, onBack, onEdit, onNew }) {
  const history = records.filter((r) => r.hn === hn).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!history.length) return <div style={{ padding: 40 }}>ไม่พบข้อมูล</div>;
  const cur = history[0];
  const risk = computeRisk(cur);
  const [selId, setSelId] = React.useState(cur.id);
  const [activeTab, setActiveTab] = React.useState("detail"); // detail | trend
  const rec = history.find((r) => r.id === selId) || cur;
  const rRisk = computeRisk(rec);

  const drpLabels = (rec.drps || []).map((k) => DRP_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
  const srcLabels = (rec.sources || []).map((k) => SOURCE_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
  const intLabels = (rec.interventions || []).map((k) => INTERVENTION_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1100, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 16 }}><Icon name="chevron" size={16} color="var(--ink-2)" /><span style={{ transform: "rotate(90deg)", display: "none" }} />กลับ</button>

      {/* header */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--brand-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="user" size={28} color="var(--brand-deep)" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{cur.name}</h1>
              <RiskBadge band={risk.band} score={risk.score} />
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-2)", marginTop: 5 }}>HN {cur.hn} · {cur.age} ปี · <StageInline stage={cur.ckdStage} /> · {history.length} ครั้งที่บันทึก</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onEdit(rec)} style={ghostBtn}><Icon name="edit" size={15} />แก้ไข</button>
            <button onClick={() => onNew(cur)} style={primaryBtn}><Icon name="plus" size={16} color="#fff" />บันทึกครั้งใหม่</button>
          </div>
        </div>

        {/* risk factors */}
        {rRisk.factors.length > 0 && (
          <div style={{ marginTop: 18, padding: "14px 16px", background: RISK_META[rRisk.band].bg, border: `1px solid ${RISK_META[rRisk.band].border}`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icon name="shield" size={16} color={RISK_META[rRisk.band].color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: RISK_META[rRisk.band].color }}>ปัจจัยเสี่ยงที่ตรวจพบ (คะแนนรวม {rRisk.score})</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {rRisk.factors.map((x, i) => (
                <span key={i} style={{ fontSize: 12.5, color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--border)", padding: "5px 11px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {x.t}<span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: RISK_META[rRisk.band].color }}>+{x.w}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {cur.followUp && <div style={{ marginTop: 12, padding: "11px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
          <Icon name="clock" size={16} color="#d97706" /><strong style={{ color: "#92400e" }}>นัดติดตาม {fmtDate(cur.followUp.due)}</strong>
          <span style={{ color: "#92400e" }}>{cur.followUp.note}</span>
        </div>}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["detail","รายละเอียด","list"],["trend","แนวโน้ม & เปรียบเทียบ","trend"]].map(([v,t,ic]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:10,border:`1px solid ${activeTab===v?"var(--brand)":"var(--border)"}`,background:activeTab===v?"var(--brand)":"var(--surface)",color:activeTab===v?"#fff":"var(--ink-2)",fontSize:14,fontWeight:activeTab===v?700:500,cursor:"pointer",fontFamily:"var(--sans)" }}>
            <Icon name={ic} size={16} color={activeTab===v?"#fff":"currentColor"} />{t}
            {v==="trend" && history.length>1 && <span style={{background:activeTab===v?"rgba(255,255,255,.3)":"var(--brand-soft)",color:activeTab===v?"#fff":"var(--brand-deep)",fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:99}}>{history.length} visits</span>}
          </button>
        ))}
      </div>

      {activeTab === "trend" ? (
        <TrendPanel history={history} onSelectVisit={(id) => { setSelId(id); setActiveTab("detail"); }} />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }} className="detail-grid">
        {/* history timeline */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, marginBottom: 12 }}>ประวัติการบันทึก</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.map((h) => {
              const hr = computeRisk(h); const on = h.id === selId;
              return (
                <button key={h.id} onClick={() => setSelId(h.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", borderRadius: 9, border: `1px solid ${on ? "var(--brand)" : "transparent"}`, background: on ? "var(--brand-soft)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: RISK_META[hr.band].color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{fmtDate(h.date)}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>eGFR {h.egfr} · K⁺ {h.k}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* selected record detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <DetailCard title="ค่าทางคลินิก" icon="kidney">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 12 }}>
              <Stat l="Scr" v={rec.scr} u="mg/dL" />
              <Stat l="eGFR" v={rec.egfr} u="mL/min" warn={rec.egfr && Number(rec.egfr) < 30} />
              <Stat l="K⁺" v={rec.k} u="mmol/L" warn={rec.k && (Number(rec.k) > 5.5 || Number(rec.k) < 3.5)} />
              <Stat l="Na⁺" v={rec.na} u="mmol/L" />
              <Stat l="BP" v={rec.bpSys && rec.bpDia ? `${rec.bpSys}/${rec.bpDia}` : "–"} u="mmHg" />
              <Stat l="HR" v={rec.hr} u="/min" />
            </div>
            {rec.allergy && rec.allergy !== "-" && <div style={{ marginTop: 12, fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "center", gap: 7 }}><Icon name="alert" size={15} color="#b91c1c" />แพ้ยา/ADR: <strong>{rec.allergy}</strong></div>}
          </DetailCard>

          <DetailCard title={`รายการยา (BPML) · ${rec.meds.length} รายการ`} icon="pill">
            {rec.meds.length ? rec.meds.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: i < rec.meds.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{m.drug}</span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{m.strength}</span>
                    {(m.flags || []).map((fl) => <FlagTag key={fl} fl={fl} />)}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3 }}>
                    สั่ง: {m.dose || "–"} · กินจริง: <span style={{ color: m.actuallyTaking && m.actuallyTaking !== "ตามสั่ง" ? "#b45309" : "var(--ink-2)" }}>{m.actuallyTaking || "–"}</span>{m.remark && ` · ${m.remark}`}
                  </div>
                </div>
              </div>
            )) : <Empty text="ไม่มีรายการยา" />}
            {rec.otcHerbal && <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", display: "flex", gap: 7, alignItems: "center" }}><Icon name="alert" size={14} color="#b45309" />ยานอก/สมุนไพร: {rec.otcDetail || "มี"}</div>}
          </DetailCard>

          {drpLabels.length > 0 && (
            <DetailCard title="ปัญหาด้านยา (DRP)" icon="alert">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: rec.drpDetail ? 10 : 0 }}>
                {drpLabels.map((l) => <span key={l} style={{ fontSize: 12.5, fontWeight: 600, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "4px 11px", borderRadius: 8 }}>{l}</span>)}
              </div>
              {rec.drpDetail && <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.6 }}>{rec.drpDetail}</p>}
            </DetailCard>
          )}

          <DetailCard title="Medication Reconciliation" icon="check">
            <KV k="เปรียบเทียบกับ" v={[rec.comparedPrev && "ใบสั่งยาเดิม", rec.comparedNew && "ใบสั่งยาใหม่"].filter(Boolean).join(", ") || "–"} />
            <KV k="ความคลาดเคลื่อน" v={rec.discrepancy === "found" ? `พบ — ${rec.discrepancyType || ""}` : "ไม่พบ"} danger={rec.discrepancy === "found"} />
            {intLabels.length > 0 && <KV k="การดำเนินการ" v={intLabels.join(", ")} />}
            {rec.outcome && <KV k="ผลลัพธ์" v={rec.outcome === "accepted" ? "แก้ไขแล้ว ✓" : `ไม่แก้ไข — ${rec.outcomeReason || ""}`} danger={rec.outcome === "not_accepted"} ok={rec.outcome === "accepted"} />}
            {srcLabels.length > 0 && <KV k="แหล่งข้อมูล" v={srcLabels.join(", ")} />}
            <KV k="เภสัชกรผู้บันทึก" v={rec.pharmacist} />
            {rec.physician && <KV k="แพทย์" v={rec.physician} />}
          </DetailCard>
        </div>
      </div>
      )} {/* end activeTab===detail */}
    </div>
  );
}

function DetailCard({ title, icon, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name={icon} size={16} color="var(--brand-deep)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Stat({ l, v, u, warn }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 3 }}>{l}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, color: warn ? "#b91c1c" : "var(--ink)" }}>{v || "–"}<span style={{ fontSize: 10.5, fontWeight: 400, color: "var(--ink-2)", marginLeft: 3 }}>{u}</span></div>
    </div>
  );
}
function KV({ k, v, danger, ok }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--ink-2)", width: 130, flexShrink: 0 }}>{k}</span>
      <span style={{ color: danger ? "#b91c1c" : ok ? "#16a34a" : "var(--ink)", fontWeight: danger || ok ? 600 : 400 }}>{v}</span>
    </div>
  );
}
function StageInline({ stage }) { return <span style={{ color: stage === "4" || stage === "5" ? "#b91c1c" : "var(--brand-deep)", fontWeight: 600 }}>CKD {stage}</span>; }

function segBtn2(on, k) {
  const colors = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
  const c = colors[k] || "var(--brand)";
  return { padding: "9px 14px", borderRadius: 9, border: `1px solid ${on ? c : "var(--border)"}`, background: on ? c + "15" : "var(--surface)", color: on ? c : "var(--ink-2)", fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" };
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function fmtDate(s) { if (!s) return "–"; const d = new Date(s); if (isNaN(d)) return s; return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; }

Object.assign(window, { PatientsList, PatientDetail, fmtDate });
