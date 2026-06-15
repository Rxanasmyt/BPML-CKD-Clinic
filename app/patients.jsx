/* =========================================================================
   patients.jsx — รายชื่อผู้ป่วย (ค้นหา/กรอง/จัดลำดับเสี่ยง) + รายละเอียด/ประวัติ
   ========================================================================= */

/* ---------- ConfirmDeleteModal ---------- */
function ConfirmDeleteModal({ rec, onConfirm, onCancel }) {
  const [reason, setReason] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const canDelete = confirm.trim() === "ลบ";
  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div className="modal-card" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:18, padding:"28px 28px 24px", width:"100%", maxWidth:440, boxShadow:"0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"#fef2f2", display:"grid", placeItems:"center", flexShrink:0 }}>
            <Icon name="alert" size={22} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--ink)" }}>ยืนยันการลบ Visit</div>
            <div style={{ fontSize:13, color:"var(--ink-2)", marginTop:2 }}>มี audit log เก็บ snapshot ไว้ — กู้คืนได้ภายหลังที่หน้า "ประวัติการลบข้อมูล" (แอดมิน)</div>
          </div>
        </div>
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 14px", marginBottom:18, fontSize:13.5 }}>
          <div style={{ fontWeight:600, color:"#b91c1c", marginBottom:4 }}>Visit ที่จะลบ:</div>
          <div style={{ color:"var(--ink)" }}>{rec.name} · HN {rec.hn}</div>
          <div style={{ color:"var(--ink-2)", fontFamily:"var(--mono)", fontSize:12.5, marginTop:2 }}>วันที่ {rec.date} · {(rec.meds||[]).length} รายการยา</div>
        </div>
        <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:6 }}>เหตุผลการลบ (ไม่บังคับ)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น บันทึกผิดผู้ป่วย, ข้อมูลซ้ำ..."
          style={{ width:"100%", padding:"10px 12px", border:"1.5px solid var(--border)", borderRadius:10, fontSize:13.5, fontFamily:"var(--sans)", color:"var(--ink)", background:"var(--surface)", boxSizing:"border-box", resize:"vertical", minHeight:72, outline:"none", marginBottom:16 }} />
        <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#b91c1c", marginBottom:6 }}>พิมพ์ "ลบ" เพื่อยืนยัน</label>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder='พิมพ์ "ลบ"'
          style={{ width:"100%", padding:"11px 12px", border:`1.5px solid ${canDelete?"#dc2626":"var(--border)"}`, borderRadius:10, fontSize:15, fontFamily:"var(--sans)", color:"var(--ink)", background:"var(--surface)", boxSizing:"border-box", outline:"none", marginBottom:18, transition:"border-color 0.2s" }} />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:"12px", border:"1.5px solid var(--border)", borderRadius:10, background:"var(--surface)", color:"var(--ink)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"var(--sans)" }}>ยกเลิก</button>
          <button onClick={() => canDelete && onConfirm(reason)} disabled={!canDelete}
            style={{ flex:1, padding:"12px", border:"none", borderRadius:10, background: canDelete?"#dc2626":"#fca5a5", color:"#fff", fontSize:14, fontWeight:700, cursor: canDelete?"pointer":"not-allowed", fontFamily:"var(--sans)", transition:"background 0.2s" }}>
            ลบ Visit นี้
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- DeleteLogPage ---------- */
function DeleteLogPage() {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);
  const [restoring, setRestoring] = React.useState(null);
  const [restoredIds, setRestoredIds] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    if (!window.db) { setLoading(false); return; }
    window.db.collection("pharm_ckd_delete_log").orderBy("deletedAt","desc").limit(200)
      .get().then((snap) => {
        if (!alive) return;
        setLogs(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // #1: กู้คืน Visit จาก snapshot — เขียนข้อมูลกลับเข้า Firestore
  async function restore(log) {
    if (!log.snapshot || !window.FirebaseStore) return;
    let rec;
    try { rec = JSON.parse(log.snapshot); } catch (e) { return; }
    if (!window.confirm(`กู้คืน Visit ของ ${log.patientName} (HN ${log.hn}) วันที่ ${log.visitDate} กลับเข้าระบบ?`)) return;
    setRestoring(log.id);
    try {
      await window.FirebaseStore.save(rec);
      // ลบ entry ออกจาก audit log เมื่อกู้คืนสำเร็จ เพื่อไม่ให้กู้ซ้ำ
      if (window.db) await window.db.collection("pharm_ckd_delete_log").doc(log.id).delete().catch(() => {});
      setRestoredIds((p) => ({ ...p, [log.id]: true }));
      if (window.showToast) window.showToast(`กู้คืน Visit ของ ${log.patientName} สำเร็จ`, "success", "กู้คืนแล้ว ✓");
    } catch (e) {
      if (window.showToast) window.showToast("กู้คืนไม่สำเร็จ: " + e.message, "error", "เกิดข้อผิดพลาด");
    }
    setRestoring(null);
  }
  return (
    <div style={{ padding:"clamp(18px,2.4vw,30px)", maxWidth:860, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:"var(--ink)", margin:"0 0 4px" }}>ประวัติการลบข้อมูล</h2>
        <p style={{ color:"var(--ink-2)", fontSize:13.5, margin:0 }}>Audit log — บันทึกทุกครั้งที่มีการลบ Visit (เฉพาะแอดมิน)</p>
      </div>
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"var(--ink-2)" }}>กำลังโหลด...</div>
      ) : !logs.length ? (
        <div style={{ textAlign:"center", padding:48, color:"var(--ink-2)", background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)" }}>ยังไม่มีประวัติการลบข้อมูล</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {logs.map((log) => (
            <div key={log.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:13, overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", cursor:"pointer" }}
                onClick={() => setExpanded(expanded===log.id ? null : log.id)}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#fef2f2", display:"grid", placeItems:"center", flexShrink:0 }}>
                  <Icon name="alert" size={18} color="#dc2626" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, color:"var(--ink)", fontSize:14 }}>{log.patientName} · HN {log.hn}</div>
                  <div style={{ color:"var(--ink-2)", fontSize:12.5, marginTop:2 }}>Visit {log.visitDate} · ลบโดย {log.deletedBy} ({log.deletedByUsername})</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:12, color:"var(--ink-2)", fontFamily:"var(--mono)" }}>{new Date(log.deletedAt).toLocaleString("th-TH")}</div>
                  {log.reason && <div style={{ fontSize:11.5, color:"#b91c1c", marginTop:2 }}>เหตุผล: {log.reason}</div>}
                </div>
              </div>
              {expanded === log.id && log.snapshot && (
                <div style={{ borderTop:"1px solid var(--border)", padding:"12px 18px", background:"var(--bg)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:"var(--ink-2)", flex:1 }}>ข้อมูล Visit ที่ถูกลบ (snapshot)</div>
                    {restoredIds[log.id] ? (
                      <span style={{ fontSize:12.5, fontWeight:700, color:"#16a34a" }}>✓ กู้คืนแล้ว</span>
                    ) : (
                      <button onClick={() => restore(log)} disabled={restoring === log.id}
                        style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", border:"none", borderRadius:9, background: restoring===log.id ? "#86efac" : "#16a34a", color:"#fff", fontSize:13, fontWeight:700, cursor: restoring===log.id ? "wait":"pointer", fontFamily:"var(--sans)" }}>
                        <Icon name="check" size={14} color="#fff" />{restoring === log.id ? "กำลังกู้คืน..." : "กู้คืน Visit นี้"}
                      </button>
                    )}
                  </div>
                  <pre style={{ fontSize:11, color:"var(--ink-2)", fontFamily:"var(--mono)", whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0, maxHeight:240, overflowY:"auto" }}>{(() => { try { return JSON.stringify(JSON.parse(log.snapshot), null, 2); } catch (e) { return typeof log.snapshot === "string" ? log.snapshot : "— ข้อมูล snapshot เสียหาย —"; } })()}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ── SVG Empty state illustration ── */
function EmptyIllustration({ text, sub }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"52px 24px", gap:14 }}>
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <rect x="14" y="10" width="60" height="70" rx="8" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="2"/>
        <rect x="24" y="26" width="40" height="3" rx="1.5" fill="var(--brand)" opacity=".45"/>
        <rect x="24" y="34" width="32" height="3" rx="1.5" fill="var(--brand)" opacity=".35"/>
        <rect x="24" y="42" width="36" height="3" rx="1.5" fill="var(--brand)" opacity=".35"/>
        <rect x="24" y="50" width="24" height="3" rx="1.5" fill="var(--brand)" opacity=".25"/>
        <circle cx="44" cy="18" r="5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2"/>
        <rect x="38" y="15.5" width="12" height="5" rx="0" fill="var(--surface)"/>
      </svg>
      <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)" }}>{text}</div>
      {sub && <div style={{ fontSize:13, color:"var(--ink-2)", textAlign:"center" }}>{sub}</div>}
    </div>
  );
}

/* ── eGFR Arc Ring ── */
function EgfrRing({ egfr, warn }) {
  const val   = parseFloat(egfr);
  const valid = !isNaN(val);
  const pct   = valid ? Math.min(val / 120, 1) : 0;
  const size  = 52, sw = 4, r = (size - sw) / 2;
  const circ  = 2 * Math.PI * r;
  const color = warn ? "#dc2626" : val >= 60 ? "#0d9488" : val >= 30 ? "#d97706" : "#dc2626";
  return (
    <div style={{ flex:"0 0 52px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:"var(--surface-2)", borderRadius:9, border:`1px solid ${warn?"#fca5a5":"var(--border)"}`, padding:"4px 0 2px" }}>
      <div style={{ fontSize:9.5, color:"var(--ink-2)", marginBottom:2 }}>eGFR</div>
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
          {valid && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${pct*circ} ${circ}`}
            style={{ animation:"ring-fill 0.9s cubic-bezier(0.22,1,0.36,1) both" }} />}
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"var(--mono)", fontSize:12, fontWeight:700, color:warn?"#dc2626":"var(--ink)" }}>
          {valid ? val : "–"}
        </div>
      </div>
    </div>
  );
}

/* ── Patient Card ── */
function PatientCard({ r, onOpen, idx }) {
  const riskColors = { high:"#dc2626", medium:"#d97706", low:"#16a34a" };
  const riskBg     = { high:"#fef2f2", medium:"#fffbeb", low:"#f0fdf4" };
  const c = riskColors[r.risk.band];
  const todayStr = todayISO();
  const overdue = r.followUp && r.followUp.due && r.followUp.due < todayStr;
  const overdueDays = overdue ? Math.round((new Date(todayStr) - new Date(r.followUp.due)) / 86400000) : 0;
  const cardRef = React.useRef(null);
  function handleTilt(e) {
    const el = cardRef.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) scale(1.012) translateZ(0)`;
  }
  function resetTilt() {
    if (cardRef.current) cardRef.current.style.transform = "";
  }

  return (
    <div ref={cardRef} onMouseMove={handleTilt} onMouseLeave={resetTilt}
      onClick={() => onOpen(r.hn)} className="card-modern card-lift card-tilt"
      style={{ background:"var(--surface)", borderRadius:16, overflow:"hidden",
        cursor:"pointer", display:"flex",
        animation:`slideInCard 0.45s cubic-bezier(0.22,1,0.36,1) ${Math.min(idx*0.05,0.4)}s both`,
        borderLeft:`4px solid ${c}` }}>
      <div style={{ flex:1, padding:"16px 16px 14px" }}>
        {/* Row 1: name + HN */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14.5, color:"var(--ink)", lineHeight:1.2 }}>{r.name}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-2)", marginTop:3 }}>
              HN {r.hn} · {r.age} ปี
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
            <StagePill stage={r.ckdStage} />
            {r.progression && (r.progression.level === "rapid" || r.progression.level === "decline" || r.progression.stageWorsened) && (
              <span title={`ประวัติ ${r.progression.visits} visit · eGFR ${r.progression.from}→${r.progression.to} ใน ${r.progression.days} วัน${r.progression.stageWorsened ? ` · ข้าม stage G${r.progression.stageFrom}→G${r.progression.stageTo}` : ""}`}
                className={r.progression.level === "rapid" ? "attn-glow" : ""}
                style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10.5, fontWeight:700,
                  color: r.progression.color, background: `${r.progression.color}14`,
                  border:`1px solid ${r.progression.color}55`, padding:"2px 7px", borderRadius:7, whiteSpace:"nowrap" }}>
                📉 {r.progression.stageWorsened ? `G${r.progression.stageFrom}→G${r.progression.stageTo}` : r.progression.label}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Lab values */}
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <EgfrRing egfr={r.egfr} warn={r.egfr && parseFloat(r.egfr)<30} />
          {[
            { label:"K⁺",  val:r.k||"–",    warn: r.k && parseFloat(r.k)>5.5 },
            { label:"BP",  val:r.bpSys ? `${r.bpSys}/${r.bpDia||"–"}` : "–", warn: r.bpSys && parseFloat(r.bpSys)>=140 },
          ].map(({ label, val, warn }) => (
            <div key={label} style={{ flex:1, padding:"6px 8px", background:warn?"#fef2f222":"var(--surface-2)",
              borderRadius:9, border:`1px solid ${warn?"#fca5a5":"var(--border)"}` }}>
              <div style={{ fontSize:9.5, color:"var(--ink-2)", marginBottom:2 }}>{label}</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:13, fontWeight:700,
                color:warn?"#dc2626":"var(--ink)" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Row 2b: OTC/Herbal indicator */}
        {(r.otcHerbal || (r.otcItems && r.otcItems.length > 0)) && (
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:"#fef9c3", border:"1px solid #fde047", color:"#854d0e", fontWeight:600 }}>
              🌿 OTC{r.otcHerbal ? "/สมุนไพร" : ""}{r.otcItems?.length ? ` ${r.otcItems.length} รายการ` : ""}
            </span>
          </div>
        )}

        {/* Row 3: Risk + follow-up */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <RiskBadge band={r.risk.band} score={r.risk.score} />
          {r.followUp ? (
            <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:11.5,
              color:overdue?"#dc2626":"#d97706",
              padding:"3px 8px", borderRadius:99,
              background:overdue?"#fef2f2":"#fffbeb",
              border:`1px solid ${overdue?"#fca5a5":"#fde68a"}` }}>
              <Icon name="clock" size={11} color={overdue?"#dc2626":"#d97706"} />
              {overdue?`เกินกำหนด ${overdueDays} วัน · `:"นัด "}{fmtDate(r.followUp.due)}
            </div>
          ) : (
            <div style={{ fontSize:11.5, color:"var(--ink-2)" }}>{fmtDate(r.date)}</div>
          )}
        </div>
        {/* KDIGO Referral Alert */}
        {(() => {
          const kdigo = kdigoReferralCheck(r, []);
          return kdigo ? (
            <div style={{ marginTop:6, padding:"4px 9px", borderRadius:8, background:"#fff1f2",
              border:"1.5px solid #fda4af", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:12 }}>🏥</span>
              <span style={{ fontSize:10.5, fontWeight:700, color:"#be123c" }}>ควรส่งต่อ Nephrology</span>
            </div>
          ) : null;
        })()}
        {/* eGFR Trajectory badge */}
        {(() => {
          const pred = r._prediction;
          if (!pred || !pred.declining) return null;
          if (!pred.monthsTo30 && !pred.monthsTo15) return null;
          const months = pred.monthsTo15 || pred.monthsTo30;
          // แสดงเฉพาะช่วงเวลาที่มีนัยทางคลินิก (ภายใน 5 ปี) — กันค่าคาดการณ์ที่ยาวเกินจริง
          if (!months || months > 60) return null;
          const label = pred.monthsTo15 ? 'Stage 5' : 'Stage 4';
          return (
            <div style={{ marginTop:6, padding:"4px 9px", borderRadius:8, background:"#fff7ed",
              border:"1px solid #fed7aa", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:11 }}>📉</span>
              <span style={{ fontSize:10.5, fontWeight:700, color:"#c2410c" }}>
                คาดถึง {label} ใน ~{months} เดือน
              </span>
            </div>
          );
        })()}
        {/* Top 3 risk drivers — แสดงเมื่อความเสี่ยง medium หรือสูง */}
        {r.risk.band !== "low" && r.risk.factors && r.risk.factors.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)", display:"flex", flexWrap:"wrap", gap:4 }}>
            {r.risk.factors.slice(0, 3).map((fa, i) => (
              <span key={i} className="chip-pop" style={{ fontSize:10.5, padding:"2px 7px", borderRadius:6,
                animationDelay: `${0.12 + i * 0.06}s`,
                background: r.risk.band === "high" ? "#fef2f2" : "#fffbeb",
                color: r.risk.band === "high" ? "#b91c1c" : "#92400e",
                border: `1px solid ${r.risk.band === "high" ? "#fca5a5" : "#fde68a"}`,
                fontWeight:600 }}>
                {fa.t}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Right arrow */}
      <div style={{ display:"flex", alignItems:"center", padding:"0 12px",
        background:`linear-gradient(90deg,transparent,${riskBg[r.risk.band]}44)` }}>
        <Icon name="chevronR" size={16} color={c} />
      </div>
    </div>
  );
}

function PatientsList({ records, user, onOpenPatient, onNew }) {
  const [q, setQ]       = React.useState("");
  const [riskF, setRiskF] = React.useState("all");
  const [stageF, setStageF] = React.useState("all");
  const [dueOnly, setDueOnly] = React.useState(false);
  const [declineOnly, setDeclineOnly] = React.useState(false);
  const [sort, setSort] = React.useState("risk");
  const [view, setView] = React.useState("card"); // card | table
  const [advOpen, setAdvOpen] = React.useState(false);
  const [egfrMin, setEgfrMin] = React.useState("");
  const [egfrMax, setEgfrMax] = React.useState("");
  const [drugF, setDrugF] = React.useState("");
  const [drpF, setDrpF] = React.useState("all");

  const scope = records; // ทุก role เห็นข้อมูลผู้ป่วยทั้งหมด
  // memoize: medProgression + predictEgfr วนทุก record — กันคำนวณซ้ำทุกครั้งที่พิมพ์ค้นหา/กรอง
  const all   = React.useMemo(
    () => latestPerPatient(scope).map((r) => ({ ...r, risk: computeRisk(r), progression: medProgression(records, r.hn), _prediction: predictEgfr(records, r.hn) })),
    [records]
  );
  const due7  = isoAddDays(7), today = todayISO();
  let rows = [...all];

  if (q.trim()) {
    const s = q.trim().toLowerCase();
    rows = rows.filter((r) =>
      r.name.toLowerCase().includes(s) ||
      (r.hn || "").includes(s) ||
      (r.allergy || "").toLowerCase().includes(s) ||
      ("ckd" + (r.ckdStage || "")).includes(s) ||
      (r.meds || []).some((m) => (m.drug || "").toLowerCase().includes(s))
    );
  }
  if (riskF !== "all") rows = rows.filter((r) => r.risk.band === riskF);
  if (stageF !== "all") rows = rows.filter((r) => r.ckdStage === stageF);
  if (dueOnly) rows = rows.filter((r) => r.followUp?.due && r.followUp.due <= due7);
  if (declineOnly) rows = rows.filter((r) => r.progression && (r.progression.level === "rapid" || r.progression.level === "decline" || r.progression.stageWorsened));
  if (egfrMin !== "") rows = rows.filter(r => !r.egfr || parseFloat(r.egfr) >= parseFloat(egfrMin));
  if (egfrMax !== "") rows = rows.filter(r => !r.egfr || parseFloat(r.egfr) <= parseFloat(egfrMax));
  if (drugF.trim()) rows = rows.filter(r => (r.meds||[]).some(m => (m.drug||'').toLowerCase().includes(drugF.trim().toLowerCase())));
  if (drpF !== "all") rows = rows.filter(r => (r.drps||[]).includes(drpF));
  rows.sort((a, b) => {
    if (sort === "risk") return b.risk.score - a.risk.score;
    if (sort === "date") return (b.date || "").localeCompare(a.date || "");
    if (sort === "egfr") return (parseFloat(a.egfr) || 999) - (parseFloat(b.egfr) || 999); // ต่ำสุดก่อน (แย่สุด)
    if (sort === "name") return (a.name || "").localeCompare(b.name || "", "th");
    return 0;
  });
  const dueCount = all.filter((r) => r.followUp?.due && r.followUp.due <= due7).length;
  const declineCount = all.filter((r) => r.progression && (r.progression.level === "rapid" || r.progression.level === "decline" || r.progression.stageWorsened)).length;

  const riskCounts = { high:0, medium:0, low:0 };
  all.forEach((r) => riskCounts[r.risk.band]++);

  const riskMeta = {
    high:   { label:"เสี่ยงสูง",  color:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
    medium: { label:"ปานกลาง",   color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
    low:    { label:"ต่ำ",        color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0" },
  };

  return (
    <div style={{ padding:"clamp(18px,2.4vw,30px)", maxWidth:1320, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
        gap:16, marginBottom:20, flexWrap:"wrap", animation:"fadeUp 0.3s ease-out both" }}>
        <div>
          <h1 style={{ fontSize:"clamp(20px,2.4vw,27px)", fontWeight:800, color:"var(--ink)", margin:0 }}>
            ผู้ป่วยทั้งหมด
          </h1>
          <p style={{ color:"var(--ink-2)", fontSize:14, margin:"6px 0 0" }}>{rows.length === all.length ? `${all.length} ราย` : `แสดง ${rows.length} จาก ${all.length} ราย`}</p>
        </div>
        <button className="btn-primary"
          style={{ ...primaryBtn, background:"linear-gradient(135deg,var(--brand),var(--brand-deep))",
            borderRadius:13, boxShadow:"0 4px 16px rgba(13,148,136,.35)", position:"relative", overflow:"hidden" }}
          onClick={(e)=>{ if(window.addRipple)window.addRipple(e); onNew(); }}>
          <Icon name="plus" size={18} color="#fff" />บันทึกผู้ป่วยใหม่
        </button>
      </div>

      {advOpen && (
        <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:12,
          padding:"14px 16px", marginBottom:12, display:"flex", gap:12, flexWrap:"wrap", alignItems:"center",
          animation:"fadeUp 0.22s ease-out both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:12, color:"var(--ink-2)", fontWeight:600, whiteSpace:"nowrap" }}>eGFR</span>
            <input type="number" placeholder="min" value={egfrMin} onChange={e=>setEgfrMin(e.target.value)}
              style={{ ...inS, width:70, height:36, fontSize:13 }} />
            <span style={{ color:"var(--ink-2)" }}>–</span>
            <input type="number" placeholder="max" value={egfrMax} onChange={e=>setEgfrMax(e.target.value)}
              style={{ ...inS, width:70, height:36, fontSize:13 }} />
          </div>
          <input placeholder="🔍 ชื่อยาเฉพาะ" value={drugF} onChange={e=>setDrugF(e.target.value)}
            style={{ ...inS, height:36, fontSize:13, width:160 }} />
          <select value={drpF} onChange={e=>setDrpF(e.target.value)}
            style={{ ...inS, height:36, fontSize:13, width:"auto", cursor:"pointer" }}>
            <option value="all">ทุก DRP</option>
            {DRP_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.th}</option>)}
          </select>
          {(egfrMin||egfrMax||drugF||drpF!=="all") && (
            <button onClick={() => { setEgfrMin(""); setEgfrMax(""); setDrugF(""); setDrpF("all"); }}
              style={{ fontSize:12, color:"#dc2626", background:"none", border:"none", cursor:"pointer", fontWeight:700, fontFamily:"var(--sans)" }}>
              ล้างตัวกรอง ✕
            </button>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:18 }}
        className="stagger">
        {[
          { label:"ทั้งหมด", value:all.length, color:"var(--brand)", bg:"var(--brand-soft)", border:"rgba(13,148,136,.3)" },
          ...Object.entries(riskMeta).map(([k,m]) => ({ label:m.label, value:riskCounts[k], color:m.color, bg:m.bg, border:m.border })),
        ].map(({ label, value, color, bg, border }, i) => (
          <div key={label} style={{ background:bg, border:`1px solid ${border}`, borderRadius:12,
            padding:"12px 16px", display:"flex", alignItems:"center", gap:10,
            animation:`fadeUp 0.3s ease-out ${i*0.06}s both` }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0,
              boxShadow:`0 0 6px ${color}88` }} />
            <span style={{ flex:1, fontSize:12.5, color, fontWeight:600 }}>{label}</span>
            <span style={{ fontFamily:"var(--mono)", fontWeight:800, fontSize:20, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 240px" }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}>
            <Icon name="search" size={17} color="var(--ink-2)" />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / HN / ยา / แพ้ยา / stage"
            style={{ ...inS, paddingLeft:38, height:42 }} />
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[["all","ทั้งหมด"],["high","เสี่ยงสูง"],["medium","ปานกลาง"],["low","ต่ำ"]].map(([k,t]) => (
            <button key={k} onClick={() => setRiskF(k)} style={segBtn2(riskF===k, k)}>{t}</button>
          ))}
        </div>
        <select value={stageF} onChange={(e) => setStageF(e.target.value)}
          style={{ ...inS, width:"auto", height:42, cursor:"pointer" }}>
          <option value="all">ทุก stage</option>
          {CKD_STAGES.map((s) => <option key={s} value={s}>CKD {s}</option>)}
        </select>
        <button onClick={() => setDueOnly((v) => !v)}
          style={{ ...inS, width:"auto", height:42, cursor:"pointer", display:"flex", alignItems:"center", gap:6,
            background: dueOnly ? "#fffbeb" : "var(--surface)", borderColor: dueOnly ? "#fcd34d" : "var(--border)",
            color: dueOnly ? "#b45309" : "var(--ink-2)", fontWeight: dueOnly ? 700 : 500, fontFamily:"var(--sans)" }}>
          📅 นัดใกล้ถึง{dueCount > 0 && <span style={{ fontFamily:"var(--mono)", fontWeight:800 }}>{dueCount}</span>}
        </button>
        <button onClick={() => setDeclineOnly((v) => !v)}
          style={{ ...inS, width:"auto", height:42, cursor:"pointer", display:"flex", alignItems:"center", gap:6,
            background: declineOnly ? "#fef2f2" : "var(--surface)", borderColor: declineOnly ? "#fca5a5" : "var(--border)",
            color: declineOnly ? "#b91c1c" : "var(--ink-2)", fontWeight: declineOnly ? 700 : 500, fontFamily:"var(--sans)" }}>
          📉 เสื่อมเร็ว{declineCount > 0 && <span style={{ fontFamily:"var(--mono)", fontWeight:800 }}>{declineCount}</span>}
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          style={{ ...inS, width:"auto", height:42, cursor:"pointer" }}>
          <option value="risk">เรียงตามความเสี่ยง</option>
          <option value="date">เรียงตามวันที่ล่าสุด</option>
          <option value="egfr">เรียงตาม eGFR (ต่ำสุดก่อน)</option>
          <option value="name">เรียงตามชื่อ (ก–ฮ)</option>
        </select>
        <button onClick={() => setAdvOpen(v => !v)}
          style={{ ...inS, width:"auto", height:42, cursor:"pointer", display:"flex", alignItems:"center", gap:6,
            background: advOpen ? "var(--brand-soft)" : "var(--surface)",
            borderColor: advOpen ? "var(--brand)" : "var(--border)",
            color: advOpen ? "var(--brand-deep)" : "var(--ink-2)",
            fontWeight: advOpen ? 700 : 500, fontFamily:"var(--sans)" }}>
          🔬 ตัวกรองเพิ่มเติม
        </button>
        {/* View toggle */}
        <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
          {[["card","⊞"],["table","☰"]].map(([v,ico]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:"8px 13px", border:"none", cursor:"pointer", fontFamily:"var(--sans)",
                background: view===v ? "var(--brand)" : "var(--surface)",
                color: view===v ? "#fff" : "var(--ink-2)", fontSize:15,
                transition:"all 0.15s" }}>{ico}</button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      {rows.length ? (
        view === "card" ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
            {rows.map((r, i) => <PatientCard key={r.id || r.hn} r={r} onOpen={onOpenPatient} idx={i} />)}
          </div>
        ) : (
          /* Table view (original) */
          <div className="ptbl-wrap" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            <div className="ptbl-head" style={{ display:"grid", gridTemplateColumns:"1.8fr 1fr 1.1fr 1.4fr 1fr 40px", gap:12, padding:"12px 18px", fontSize:11.5, fontWeight:700, color:"var(--ink-2)", textTransform:"uppercase", letterSpacing:.4, background:"var(--surface-2)", borderBottom:"1px solid var(--border)" }}>
              <span>ผู้ป่วย</span><span>ระยะ CKD</span><span>ค่าแล็บ</span><span>ความเสี่ยง</span><span>บันทึกล่าสุด</span><span></span>
            </div>
            {rows.map((r, i) => (
              <div key={r.id || r.hn} onClick={() => onOpenPatient(r.hn)} className="prow"
                style={{ display:"grid", gridTemplateColumns:"1.8fr 1fr 1.1fr 1.4fr 1fr 40px", gap:12, padding:"13px 18px",
                  alignItems:"center", borderBottom:"1px solid var(--border)", cursor:"pointer",
                  borderLeft:`3px solid ${r.risk.band==="high"?"#dc2626":r.risk.band==="medium"?"#d97706":"#16a34a"}`,
                  animation:`fadeUp 0.28s ease-out ${Math.min(i*0.04,0.3)}s both` }}>
                <div>
                  <div style={{ fontWeight:600, color:"var(--ink)", fontSize:14.5 }}>{r.name}</div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:11.5, color:"var(--ink-2)" }}>HN {r.hn} · {r.age} ปี</div>
                </div>
                <div><StagePill stage={r.ckdStage} /></div>
                <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--ink-2)", lineHeight:1.5 }}>
                  eGFR {r.egfr||"–"}<br />K⁺ {r.k||"–"}
                </div>
                <div><RiskBadge band={r.risk.band} score={r.risk.score} />
                  {r.followUp && <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5, fontSize:11.5, color:"#d97706" }}><Icon name="clock" size={12} color="#d97706" />นัด {fmtDate(r.followUp.due)}</div>}
                </div>
                <div style={{ fontSize:12.5, color:"var(--ink-2)" }}>{fmtDate(r.date)}</div>
                <Icon name="chevronR" size={16} color="var(--ink-2)" />
              </div>
            ))}
          </div>
        )
      ) : all.length === 0 ? (
        <div className="card-modern" style={{ background:"var(--surface)", borderRadius:20, padding:"clamp(32px,5vw,60px) 24px", textAlign:"center", animation:"scaleIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both" }}>
          <div className="float-anim" style={{ fontSize:60, marginBottom:8 }}>🗂️</div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"var(--ink)", margin:"0 0 8px" }}>ยังไม่มีผู้ป่วยในระบบ</h2>
          <p style={{ fontSize:14, color:"var(--ink-2)", maxWidth:380, margin:"0 auto 24px", lineHeight:1.6 }}>
            เริ่มบันทึกข้อมูลการทำ Medication Reconciliation ของผู้ป่วยรายแรก
          </p>
          <button onClick={(e)=>{ if(window.addRipple)window.addRipple(e); onNew(); }} className="btn-primary"
            style={{ display:"inline-flex", alignItems:"center", gap:9, padding:"13px 28px",
              background:"linear-gradient(135deg,var(--brand),var(--brand-deep))", color:"#fff",
              border:"none", borderRadius:13, fontSize:15, fontWeight:700, cursor:"pointer",
              fontFamily:"var(--sans)", boxShadow:"0 5px 18px rgba(13,148,136,.38)" }}>
            <Icon name="plus" size={19} color="#fff" />บันทึกผู้ป่วยรายแรก
          </button>
        </div>
      ) : (
        <EmptyIllustration text="ไม่พบผู้ป่วยตามเงื่อนไข" sub="ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น" />
      )}
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

/* ---------- SVG Lab Trend Chart with reference lines ---------- */
function LabTrendChart({ points, labels, height = 110, color, refLines = [] }) {
  const w = 480, padL = 38, padR = 20, padT = 12, padB = 28;
  const chartW = w - padL - padR;
  const chartH = height - padT - padB;
  const allVals = [...points.filter((v) => v != null), ...refLines.map((r) => r.value)];
  if (!allVals.length) return null;
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const span = rawMax - rawMin || 1;
  const minV = rawMin - span * 0.1;
  const maxV = rawMax + span * 0.1;
  const toY = (v) => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;
  const toX = (i) => padL + (points.length <= 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const validPts = points.map((p, i) => ({ v: p, i })).filter((x) => x.v != null);
  const pathD = validPts.map(({ v, i }, idx) => `${idx === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  const areaD = validPts.length > 1
    ? `${pathD} L ${toX(validPts[validPts.length - 1].i).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${toX(validPts[0].i).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
    : "";
  const ticks = [minV + (maxV - minV) * 0.1, minV + (maxV - minV) * 0.5, maxV - (maxV - minV) * 0.1];
  const gradId = "lg" + color.replace(/[^a-z0-9]/gi, "").slice(0, 6);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={toY(t)} y2={toY(t)} stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />
          <text x={padL - 3} y={toY(t)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 9, fill: "var(--ink-2)", fontFamily: "monospace" }}>{t.toFixed(0)}</text>
        </g>
      ))}
      {refLines.map((r, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={toY(r.value)} y2={toY(r.value)} stroke={r.color} strokeWidth="1.5" strokeDasharray="6,4" />
          <text x={w - padR + 3} y={toY(r.value)} textAnchor="start" dominantBaseline="middle" style={{ fontSize: 9, fill: r.color, fontFamily: "monospace", fontWeight: 700 }}>{r.value}</text>
        </g>
      ))}
      {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {validPts.map(({ v, i }) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r="3.5" fill="var(--surface)" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={toX(i)} y={height - 3} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-2)", fontFamily: "monospace" }}>{l}</text>
      ))}
    </svg>
  );
}

function TrendPanel({ history, onSelectVisit }) {
  const chrono = [...history].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels  = chrono.map((r) => fmtDate(r.date));
  const shortLabels = chrono.map((r) => { if (!r.date) return "–"; const d = new Date(r.date); return isNaN(d) ? r.date : `${d.getDate()}/${d.getMonth() + 1}`; });

  function egfrColor(v) { if (!v) return "var(--brand)"; if (v >= 60) return "#16a34a"; if (v >= 30) return "#d97706"; return "#dc2626"; }
  function kColor(v) { if (!v) return "#7c3aed"; if (v > 5.5) return "#dc2626"; if (v > 5.0 || v < 3.5) return "#d97706"; return "#16a34a"; }
  function bpColor(v) { if (!v) return "#dc2626"; return v >= 160 ? "#dc2626" : v >= 140 ? "#d97706" : "#16a34a"; }

  const chartDefs = [
    { key: "egfr", label: "eGFR", unit: "mL/min", good: "high",
      refLines: [{ value: 60, color: "#16a34a" }, { value: 30, color: "#d97706" }, { value: 15, color: "#dc2626" }],
      getColor: (v) => egfrColor(v) },
    { key: "scr", label: "Scr", unit: "mg/dL", good: "low",
      refLines: [],
      getColor: () => "#0e7490" },
    { key: "k", label: "K⁺ Potassium", unit: "mmol/L", good: "normal",
      refLines: [{ value: 5.0, color: "#d97706" }, { value: 5.5, color: "#dc2626" }],
      getColor: (v) => kColor(v) },
    { key: "bpSys", label: "BP Systolic", unit: "mmHg", good: "low",
      refLines: [{ value: 140, color: "#d97706" }, { value: 160, color: "#dc2626" }],
      getColor: (v) => bpColor(v) },
    { key: "hb", label: "Hb Hemoglobin", unit: "g/dL", good: "high",
      refLines: [{ value: 10, color: "#d97706" }],
      getColor: (v) => (!v ? "#be185d" : v < 10 ? "#dc2626" : v < 11 ? "#d97706" : "#16a34a") },
  ];

  // ---------- Trend-based alerts (progression / persistent DRP / polypharmacy) ----------
  const trendAlerts = (() => {
    const out = [];
    // eGFR progression: เทียบ visit แรกกับล่าสุดที่มีค่า + ปรับเป็นต่อปี
    const eg = chrono.map((r) => ({ v: parseFloat(r.egfr), d: r.date })).filter((x) => !isNaN(x.v) && x.d);
    if (eg.length >= 2) {
      const first = eg[0], lastE = eg[eg.length - 1];
      const days = (new Date(lastE.d) - new Date(first.d)) / 86400000;
      if (days >= 90) {
        const drop = first.v - lastE.v; // บวก = แย่ลง
        const perYear = drop / (days / 365);
        if (perYear >= 5) out.push({ sev: "high", msg: `⚠️ eGFR ลดลง ~${perYear.toFixed(1)} mL/min/ปี (${first.v}→${lastE.v}) — CKD progression เร็วกว่าปกติ`, rec: "ทบทวนสาเหตุ (BP, proteinuria, NSAID, volume); เพิ่ม renoprotection ตาม KDIGO" });
        else if (perYear >= 3) out.push({ sev: "med", msg: `eGFR ลดลง ~${perYear.toFixed(1)} mL/min/ปี (${first.v}→${lastE.v}) — เฝ้าระวัง progression`, rec: "ติดตามถี่ขึ้น; ทบทวนปัจจัยเร่ง CKD" });
      }
    }
    // Persistent DRP: DRP เดียวกันปรากฏ ≥2 visit ติดกันล่าสุด
    if (chrono.length >= 2) {
      const lastV = chrono[chrono.length - 1], prevV = chrono[chrono.length - 2];
      const persist = (lastV.drps || []).filter((d) => (prevV.drps || []).includes(d));
      if (persist.length) {
        const labels = persist.map((k) => (DRP_OPTIONS.find((o) => o.key === k) || {}).th || k).join(", ");
        out.push({ sev: "med", msg: `DRP เดิมยังคงอยู่ ≥2 ครั้งติดกัน: ${labels}`, rec: "DRP ยังไม่ได้รับการแก้ไข — ทบทวน intervention และติดตามผล" });
      }
    }
    // Polypharmacy trend: จำนวนยาเพิ่มขึ้น
    const counts = chrono.map((r) => (r.meds || []).filter((m) => m.drug && m.drug.trim()).length);
    if (counts.length >= 2) {
      const lastC = counts[counts.length - 1], firstC = counts[0];
      if (lastC >= 10) out.push({ sev: "med", msg: `Polypharmacy: ปัจจุบัน ${lastC} รายการยา (≥10) — เสี่ยง DDI/adherence`, rec: "พิจารณา deprescribing; ทบทวนความจำเป็นของแต่ละยา" });
      else if (lastC - firstC >= 3) out.push({ sev: "low", msg: `จำนวนยาเพิ่มขึ้น ${firstC}→${lastC} รายการ — เฝ้าระวัง polypharmacy`, rec: "ทบทวนรายการยาเป็นระยะ" });
    }
    return out;
  })();

  const alertTone = { high: { bg: "#fef2f2", bd: "#fca5a5", c: "#b91c1c" }, med: { bg: "#fffbeb", bd: "#fcd34d", c: "#b45309" }, low: { bg: "#eff6ff", bd: "#bfdbfe", c: "#1d4ed8" } };

  return (
    <div>
      {/* Trend-based alerts */}
      {trendAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {trendAlerts.map((a, i) => {
            const t = alertTone[a.sev];
            return (
              <div key={i} style={{ border: `1.5px solid ${t.bd}`, background: t.bg, borderRadius: 12, padding: "11px 15px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.c, lineHeight: 1.4 }}>{a.msg}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }}>→ {a.rec}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Lab Trend Charts */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
          <Icon name="trend" size={17} color="var(--brand-deep)" />
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", margin: 0 }}>แนวโน้มค่าแล็บ (Lab Trends)</h3>
          <span style={{ fontSize: 12, color: "var(--ink-2)", marginLeft: "auto" }}>{chrono.length} visit · เส้นประ = ค่าอ้างอิง</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {chartDefs.map((cd) => {
            const vals = chrono.map((r) => { const v = parseFloat(r[cd.key]); return isNaN(v) ? null : v; });
            const valid = vals.filter((v) => v != null);
            if (valid.length < 1) return null;
            const last = valid[valid.length - 1];
            const prev = valid[valid.length - 2];
            const delta = prev != null ? +(last - prev).toFixed(2) : null;
            const c = cd.getColor(last);
            const goodUp = cd.good === "high";
            const arrowColor = delta == null ? "var(--ink-2)" : (goodUp ? (delta >= 0 ? "#16a34a" : "#dc2626") : (delta <= 0 ? "#16a34a" : "#dc2626"));
            return (
              <div key={cd.key} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{cd.label}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{cd.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 700, color: c, lineHeight: 1 }}>{last}</span>
                    {delta != null && (
                      <div style={{ fontSize: 12, color: arrowColor, fontWeight: 700, marginTop: 2 }}>
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{delta !== 0 ? Math.abs(delta).toFixed(1) : ""}
                        <span style={{ fontWeight: 400, color: "var(--ink-2)", marginLeft: 4, fontSize: 11 }}>จากครั้งก่อน</span>
                      </div>
                    )}
                  </div>
                </div>
                <LabTrendChart points={vals} labels={shortLabels} height={120} color={c} refLines={cd.refLines} />
                {cd.refLines.length > 0 && (
                  <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                    {cd.refLines.map((rl, i) => (
                      <span key={i} style={{ fontSize: 10.5, color: rl.color, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={rl.color} strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                        {rl.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini trend cards */}
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

/* ---------- Print / PDF Modal ---------- */
function PrintModal({ rec, patient, onClose }) {
  const risk = computeRisk(rec);
  const [mode, setMode] = React.useState("clinical"); // clinical | patient
  const autoFindings = React.useMemo(() => {
    try {
      if (typeof window.analyzeDRPs !== "function") return [];
      const res = window.analyzeDRPs({ meds: rec.meds || [], otcItems: rec.otcItems || [], egfr: rec.egfr, k: rec.k, ckdStage: rec.ckdStage, hb: rec.hb, hco3: rec.hco3, phos: rec.phos, ca: rec.ca, bpSys: rec.bpSys, bpDia: rec.bpDia, uacr: rec.uacr, dm: rec.dm });
      return (res && Array.isArray(res.findings)) ? res.findings : [];
    } catch (e) { return []; }
  }, [rec]);
  const drpLabels = (rec.drps || []).map((k) => DRP_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
  const intLabels = (rec.interventions || []).map((k) => INTERVENTION_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);

  function doPrint() {
    const printStyles = `
      @media print {
        body > * { display: none !important; }
        #ckd-print-area { display: block !important; }
        #ckd-print-area { position: fixed; top: 0; left: 0; width: 100%; background: #fff; z-index: 99999; padding: 24px; box-sizing: border-box; }
      }
    `;
    let styleEl = document.getElementById("ckd-print-style");
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "ckd-print-style"; document.head.appendChild(styleEl); }
    styleEl.textContent = printStyles;
    window.print();
  }

  const ptbl = { width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 };
  const pth = { padding: "8px 10px", background: "#f0f9f8", borderBottom: "2px solid #0d9488", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#0f766e" };
  const ptd = { padding: "8px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const ptdKey = { ...ptd, color: "#6b7280", width: 160, fontWeight: 600 };

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
      <div className="modal-card" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 780, boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, background: "#e5e7eb", borderRadius: 9, padding: 3 }}>
            <button onClick={() => setMode("clinical")} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)", background: mode === "clinical" ? "#fff" : "transparent", color: mode === "clinical" ? "#0f766e" : "#6b7280", boxShadow: mode === "clinical" ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>📋 สำหรับแพทย์/เวชระเบียน</button>
            <button onClick={() => setMode("patient")} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)", background: mode === "patient" ? "#fff" : "transparent", color: mode === "patient" ? "#0f766e" : "#6b7280", boxShadow: mode === "patient" ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>👤 เอกสารยาผู้ป่วย</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={doPrint} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" }}>
              <Icon name="download" size={16} color="#fff" />พิมพ์ / บันทึก PDF
            </button>
            <button onClick={onClose} style={{ ...ghostBtn, padding: "9px 14px" }}><Icon name="x" size={16} />ปิด</button>
          </div>
        </div>

        {/* Printable area */}
        <div id="ckd-print-area" style={{ padding: "28px 32px", fontFamily: "sans-serif", color: "#111" }}>
          {mode === "patient" ? <PatientMedHandout rec={rec} patient={patient} /> : (<>
          {/* Letterhead */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, borderBottom: "3px solid #0d9488", paddingBottom: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: "#0d9488", display: "grid", placeItems: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>RX</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0f766e" }}>BPML CKD Clinic — ใบสรุปการดูแลด้านยา</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Medication Reconciliation Summary · พิมพ์วันที่ {new Date().toLocaleDateString("th-TH")}</div>
            </div>
          </div>

          {/* Patient info */}
          <table style={ptbl}>
            <thead><tr><th style={pth} colSpan={2}>ข้อมูลผู้ป่วย</th></tr></thead>
            <tbody>
              <tr><td style={ptdKey}>ชื่อ-สกุล</td><td style={ptd}><strong>{patient.name}</strong></td></tr>
              <tr><td style={ptdKey}>HN</td><td style={ptd}>{patient.hn}</td></tr>
              <tr><td style={ptdKey}>อายุ</td><td style={ptd}>{patient.age} ปี</td></tr>
              <tr><td style={ptdKey}>ระยะ CKD</td><td style={ptd}>CKD {rec.ckdStage}</td></tr>
              <tr><td style={ptdKey}>วันที่บันทึก</td><td style={ptd}>{fmtDate(rec.date)}</td></tr>
              <tr><td style={ptdKey}>เภสัชกร</td><td style={ptd}>{rec.pharmacist || "–"}</td></tr>
              {rec.allergy && rec.allergy !== "-" && <tr><td style={ptdKey}>แพ้ยา/ADR</td><td style={{ ...ptd, color: "#b91c1c", fontWeight: 600 }}>{rec.allergy}</td></tr>}
            </tbody>
          </table>

          {/* Lab values */}
          <table style={ptbl}>
            <thead><tr><th style={pth} colSpan={6}>ค่าทางคลินิก</th></tr></thead>
            <thead><tr>{["Scr (mg/dL)","eGFR (mL/min)","K⁺ (mmol/L)","Na⁺ (mmol/L)","BP (mmHg)","HR (/min)"].map((h) => <th key={h} style={{ ...pth, background: "#e0f2f1" }}>{h}</th>)}</tr></thead>
            <tbody>
              <tr>
                <td style={{ ...ptd, textAlign: "center", fontWeight: 700 }}>{rec.scr || "–"}</td>
                <td style={{ ...ptd, textAlign: "center", fontWeight: 700, color: rec.egfr && Number(rec.egfr) < 30 ? "#dc2626" : "#111" }}>{rec.egfr || "–"}</td>
                <td style={{ ...ptd, textAlign: "center", fontWeight: 700, color: rec.k && Number(rec.k) > 5.5 ? "#dc2626" : "#111" }}>{rec.k || "–"}</td>
                <td style={{ ...ptd, textAlign: "center" }}>{rec.na || "–"}</td>
                <td style={{ ...ptd, textAlign: "center" }}>{rec.bpSys && rec.bpDia ? `${rec.bpSys}/${rec.bpDia}` : "–"}</td>
                <td style={{ ...ptd, textAlign: "center" }}>{rec.hr || "–"}</td>
              </tr>
            </tbody>
            {(rec.hb || rec.hco3 || rec.phos || rec.ca || rec.uacr || rec.dm) && (
              <>
                <thead><tr>{["Hb (g/dL)","HCO₃⁻ (mEq/L)","PO₄ (mmol/L)","Ca (mmol/L)","UACR (mg/g)","เบาหวาน"].map((h) => <th key={h} style={{ ...pth, background: "#e0f2f1" }}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <td style={{ ...ptd, textAlign: "center", color: rec.hb && Number(rec.hb) < 10 ? "#dc2626" : "#111" }}>{rec.hb || "–"}</td>
                    <td style={{ ...ptd, textAlign: "center", color: rec.hco3 && Number(rec.hco3) < 22 ? "#dc2626" : "#111" }}>{rec.hco3 || "–"}</td>
                    <td style={{ ...ptd, textAlign: "center", color: rec.phos && Number(rec.phos) > 1.78 ? "#dc2626" : "#111" }}>{rec.phos || "–"}</td>
                    <td style={{ ...ptd, textAlign: "center" }}>{rec.ca || "–"}</td>
                    <td style={{ ...ptd, textAlign: "center", color: rec.uacr && Number(rec.uacr) >= 300 ? "#dc2626" : "#111" }}>{rec.uacr || "–"}</td>
                    <td style={{ ...ptd, textAlign: "center" }}>{rec.dm ? "✓" : "–"}</td>
                  </tr>
                </tbody>
              </>
            )}
          </table>

          {/* Medications */}
          <table style={ptbl}>
            <thead><tr><th style={pth} colSpan={4}>รายการยา (BPML) — {(rec.meds || []).length} รายการ</th></tr></thead>
            <thead><tr>{["#","ยา / ความแรง","ขนาดที่สั่ง","การกินจริง"].map((h) => <th key={h} style={{ ...pth, background: "#e0f2f1" }}>{h}</th>)}</tr></thead>
            <tbody>
              {(rec.meds || []).length ? (rec.meds || []).map((m, i) => (
                <tr key={i}>
                  <td style={{ ...ptd, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                  <td style={ptd}><strong>{m.drug}</strong> {m.strength}</td>
                  <td style={ptd}>{m.dose || "–"}</td>
                  <td style={{ ...ptd, color: m.actuallyTaking && m.actuallyTaking !== "ตามสั่ง" ? "#b45309" : "#111" }}>{m.actuallyTaking || "–"}{m.remark ? ` (${m.remark})` : ""}</td>
                </tr>
              )) : <tr><td colSpan={4} style={{ ...ptd, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการยา</td></tr>}
            </tbody>
          </table>

          {/* DRP */}
          {(drpLabels.length > 0 || (autoFindings && autoFindings.length > 0)) && (
            <table style={ptbl}>
              <thead><tr><th style={{ ...pth, color: "#b91c1c", background: "#fef2f2", borderBottomColor: "#dc2626" }} colSpan={2}>ปัญหาด้านยา (DRP)</th></tr></thead>
              <tbody>
                {drpLabels.length > 0 && <tr><td style={ptdKey}>ประเภท DRP</td><td style={ptd}>{drpLabels.join(", ")}</td></tr>}
                {rec.drpDetail && <tr><td style={ptdKey}>รายละเอียด</td><td style={ptd}>{rec.drpDetail}</td></tr>}
                {autoFindings && autoFindings.length > 0 && (
                  <tr><td style={ptdKey}>ผลวิเคราะห์อัตโนมัติ</td><td style={ptd}>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {autoFindings.map((fd, i) => (
                        <li key={i} style={{ marginBottom: 4, color: fd.sev === "HIGH" ? "#b91c1c" : "#111" }}>
                          {fd.msg}{fd.rec ? <span style={{ color: "#6b7280" }}> → {fd.rec}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Counseling note */}
          {rec.counselingNote && (
            <table style={ptbl}>
              <thead><tr><th style={pth} colSpan={2}>คำแนะนำที่ให้ผู้ป่วย (Counseling)</th></tr></thead>
              <tbody><tr><td style={{ ...ptd, whiteSpace: "pre-wrap", lineHeight: 1.6 }} colSpan={2}>{rec.counselingNote}</td></tr></tbody>
            </table>
          )}

          {/* Reconciliation outcome */}
          <table style={ptbl}>
            <thead><tr><th style={pth} colSpan={2}>Medication Reconciliation</th></tr></thead>
            <tbody>
              <tr><td style={ptdKey}>ความคลาดเคลื่อน</td><td style={{ ...ptd, color: rec.discrepancy === "found" ? "#b91c1c" : "#16a34a", fontWeight: 600 }}>{rec.discrepancy === "found" ? `พบ — ${rec.discrepancyType || ""}` : "ไม่พบ"}</td></tr>
              {intLabels.length > 0 && <tr><td style={ptdKey}>การดำเนินการ</td><td style={ptd}>{intLabels.join(", ")}</td></tr>}
              {rec.outcome && <tr><td style={ptdKey}>ผลลัพธ์</td><td style={{ ...ptd, color: rec.outcome === "accepted" ? "#16a34a" : "#b91c1c", fontWeight: 600 }}>{rec.outcome === "accepted" ? "แก้ไขแล้ว" : `ไม่แก้ไข — ${rec.outcomeReason || ""}`}</td></tr>}
              <tr><td style={ptdKey}>ความเสี่ยง</td><td style={{ ...ptd, fontWeight: 700, color: RISK_META[risk.band].color }}>{RISK_META[risk.band].th} (คะแนน {risk.score})</td></tr>
            </tbody>
          </table>

          {/* Follow up */}
          {rec.followUp && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginTop: 8, fontSize: 13 }}>
              <strong style={{ color: "#92400e" }}>นัดติดตาม {fmtDate(rec.followUp.due)}</strong>
              {rec.followUp.note && <span style={{ color: "#92400e", marginLeft: 8 }}>{rec.followUp.note}</span>}
            </div>
          )}

          <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 14, fontSize: 11, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
            <span>PHARM-CKD System · BPML CKD Clinic</span>
            <span>พิมพ์โดย: {rec.pharmacist || "–"} · {fmtDate(rec.date)}</span>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PatientMedHandout — เอกสารยาสำหรับผู้ป่วย (ภาษาไทย เข้าใจง่าย ตัวอักษรใหญ่)
   รายการยา + วิธีกิน + สิ่งที่ต้องระวัง + คำแนะนำดูแลไต + วันนัด
   ========================================================================= */
function FREQ_THAI(m) {
  // แปลความถี่เป็นภาษาง่าย ๆ
  const f = parseInt(m.freqPerDay) || 0;
  const q = parseInt(m.qtyPerDose) || 0;
  const map = { 1: "วันละ 1 ครั้ง", 2: "วันละ 2 ครั้ง (เช้า-เย็น)", 3: "วันละ 3 ครั้ง (เช้า-กลางวัน-เย็น)", 4: "วันละ 4 ครั้ง" };
  const freqTxt = map[f] || (m.dose || "ตามแพทย์สั่ง");
  const qtyTxt = q ? `ครั้งละ ${q} เม็ด ` : "";
  return `${qtyTxt}${freqTxt}`;
}
function PatientMedHandout({ rec, patient }) {
  const meds = (rec.meds || []).filter((m) => m.drug && m.drug.trim());
  // คำเตือนเฉพาะยาจากฐานข้อมูล (flags) — แปลเป็นคำง่าย ๆ
  const warnFor = (drug) => {
    const info = (typeof lookupDrug === "function") ? lookupDrug(drug) : null;
    const flags = (info && info.flags) || [];
    const w = [];
    if (flags.includes("nephrotoxic")) w.push("⚠️ ยาที่ต้องระวังเรื่องไต — ห้ามปรับขนาดเอง");
    if (flags.includes("renal")) w.push("ขนาดยาปรับตามค่าไต — กินตามที่แพทย์สั่งเท่านั้น");
    if (flags.includes("k")) w.push("อาจทำให้โพแทสเซียมสูง — เลี่ยงอาหารโพแทสเซียมสูงตามคำแนะนำ");
    return w;
  };
  const hb = { width: "100%", borderCollapse: "collapse", fontSize: 15, marginBottom: 18 };
  const hth = { padding: "10px 12px", background: "#0d9488", color: "#fff", textAlign: "left", fontWeight: 700, fontSize: 14 };
  const htd = { padding: "11px 12px", borderBottom: "1px solid #d1d5db", verticalAlign: "top", lineHeight: 1.5 };
  return (
    <div style={{ fontFamily: "sans-serif", color: "#111" }}>
      {/* หัวกระดาษ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, borderBottom: "3px solid #0d9488", paddingBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: "#0d9488", display: "grid", placeItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>RX</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#0f766e" }}>รายการยาของคุณ</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>คลินิกโรคไต BPML · วันที่ {fmtDate(rec.date)}</div>
        </div>
      </div>

      {/* ชื่อผู้ป่วย */}
      <div style={{ fontSize: 17, marginBottom: 6 }}><strong>{patient.name}</strong> &nbsp;<span style={{ color: "#6b7280", fontSize: 14 }}>HN {patient.hn} · อายุ {patient.age} ปี</span></div>
      {rec.allergy && rec.allergy !== "-" && (
        <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 15, color: "#b91c1c", fontWeight: 700 }}>
          🚫 ประวัติแพ้ยา: {rec.allergy} — แจ้งทุกครั้งที่พบแพทย์/เภสัชกร
        </div>
      )}

      {/* ตารางยา */}
      <table style={hb}>
        <thead><tr>
          <th style={{ ...hth, width: 36, textAlign: "center" }}>#</th>
          <th style={hth}>ชื่อยา</th>
          <th style={hth}>วิธีกิน</th>
        </tr></thead>
        <tbody>
          {meds.length ? meds.map((m, i) => {
            const warns = warnFor(m.drug);
            return (
              <tr key={i}>
                <td style={{ ...htd, textAlign: "center", color: "#9ca3af", fontWeight: 700 }}>{i + 1}</td>
                <td style={htd}><strong style={{ fontSize: 16 }}>{m.drug}</strong>{m.strength ? <span style={{ color: "#374151" }}> {m.strength}</span> : ""}</td>
                <td style={htd}>
                  <span style={{ fontSize: 15 }}>{FREQ_THAI(m)}</span>
                  {m.remark ? <div style={{ color: "#6b7280", fontSize: 13.5, marginTop: 2 }}>{m.remark}</div> : null}
                  {warns.map((w, j) => <div key={j} style={{ color: "#b45309", fontSize: 13, marginTop: 3 }}>{w}</div>)}
                </td>
              </tr>
            );
          }) : <tr><td colSpan={3} style={{ ...htd, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการยา</td></tr>}
        </tbody>
      </table>

      {/* คำแนะนำดูแลไต */}
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#0f766e", marginBottom: 8 }}>ข้อควรปฏิบัติเพื่อดูแลไต</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#134e4a" }}>
          <li>กินยาให้ครบ ตรงเวลา ทุกวัน อย่าหยุดยาเองโดยไม่ปรึกษาแพทย์</li>
          <li>หลีกเลี่ยงยาแก้ปวดกลุ่ม NSAID (เช่น ibuprofen, diclofenac) และยาชุด ยาสมุนไพรที่ไม่ทราบส่วนผสม</li>
          <li>ควบคุมความดันโลหิตและน้ำตาลตามเป้าหมาย ลดอาหารเค็ม</li>
          <li>ดื่มน้ำตามที่แพทย์แนะนำ และมาตรวจตามนัดทุกครั้ง</li>
          <li>หากมีอาการบวม เหนื่อย ปัสสาวะน้อยลง หรือผิดปกติ ให้รีบพบแพทย์</li>
        </ul>
      </div>

      {/* วันนัด */}
      {rec.followUp && rec.followUp.due && (
        <div style={{ background: "#fffbeb", border: "2px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 16 }}>
          <strong style={{ color: "#92400e" }}>📅 นัดครั้งถัดไป: {fmtDate(rec.followUp.due)}</strong>
          {rec.followUp.note && <div style={{ color: "#92400e", marginTop: 4, fontSize: 14 }}>{rec.followUp.note}</div>}
        </div>
      )}

      <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 12, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        เอกสารนี้จัดทำโดยเภสัชกร {rec.pharmacist || ""} · คลินิกโรคไต BPML · หากมีข้อสงสัยเรื่องยา โปรดสอบถามเภสัชกร
      </div>
    </div>
  );
}

/* =========================================================================
   LineReminderModal — สร้างข้อความนัดหมาย LINE/SMS สำหรับผู้ป่วย
   ========================================================================= */
function LineReminderModal({ rec, patient, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const meds = (rec.meds || []).filter((m) => m.drug && m.drug.trim());
  const followUp = patient?.followUp;
  const followDate = followUp?.due ? fmtDate(followUp.due) : null;
  const hasHighRisk = (typeof window.analyzeDRPs === "function")
    ? (window.analyzeDRPs(rec).findings || []).some((f) => f.sev === "HIGH")
    : (rec.drps || []).length > 0;
  const hyperK = parseFloat(rec.k) > 5.5;

  const lines = [
    `🏥 คลินิกโรคไตเรื้อรัง (CKD)`,
    `─────────────────────`,
    `สวัสดีค่ะ คุณ${rec.name}`,
    ``,
    followDate ? `📅 วันนัดครั้งต่อไป: ${followDate}` : `📅 วันนัด: กรุณาติดต่อคลินิก`,
    followUp?.note ? `   หมายเหตุ: ${followUp.note}` : null,
    `⏰ กรุณามาก่อนเวลา 15 นาที`,
    `🩸 งดอาหาร-น้ำก่อนตรวจเลือด (6–8 ชั่วโมง)`,
    ``,
    meds.length ? `💊 ยาที่ต้องนำมาทุกครั้ง:` : null,
    ...meds.map((m, i) => `  ${i + 1}. ${m.drug}${m.strength ? ` ${m.strength}` : ""}${m.dose ? ` — ${m.dose}` : ""}`),
    ``,
    `⚠️ คำแนะนำสำหรับผู้ป่วยโรคไต:`,
    `  • ห้ามซื้อยาแก้ปวด NSAID กินเอง (ibuprofen, diclofenac)`,
    `  • ลดอาหารเค็มและโปรตีน`,
    `  • ดื่มน้ำตามที่แพทย์กำหนด`,
    `  • ห้ามหยุดยาหรือปรับขนาดเองโดยไม่ปรึกษาแพทย์`,
    hyperK ? `  • ⚡ โพแทสเซียมสูง — เลี่ยงกล้วย ส้ม มะเขือเทศ มันฝรั่ง` : null,
    hasHighRisk ? `` : null,
    hasHighRisk ? `🚨 มีปัญหาด้านยาที่ต้องติดตาม — กรุณาแจ้งเภสัชกรเมื่อมาพบ` : null,
    ``,
    `📞 สอบถามเพิ่มเติม: ติดต่อคลินิก`,
    `─────────────────────`,
  ].filter((l) => l !== null).join("\n");

  function copy() {
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = lines;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 500, boxShadow: "0 24px 60px rgba(0,0,0,.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#dcfce7", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 19 }}>💬</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>ข้อความนัดหมาย LINE / SMS</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>คัดลอกแล้วส่งผ่าน LINE หรือ SMS ให้ผู้ป่วย</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={20} color="var(--ink-2)" />
          </button>
        </div>

        {/* Message preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <pre style={{ margin: 0, padding: "16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, color: "var(--ink)", lineHeight: 1.75, whiteSpace: "pre-wrap", fontFamily: "var(--sans)" }}>
            {lines}
          </pre>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, padding: "16px 22px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button onClick={copy}
            style={{ flex: 1, padding: "12px", background: copied ? "#16a34a" : "#0d9488", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <span>{copied ? "✓" : "📋"}</span>{copied ? "คัดลอกแล้ว!" : "คัดลอกข้อความ"}
          </button>
          <button onClick={onClose}
            style={{ padding: "12px 18px", background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" }}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   AiSummaryModal — สรุป BPML สำหรับแพทย์ด้วย Claude AI
   ========================================================================= */
function AiSummaryModal({ rec, patient, onClose }) {
  const [apiKey, setApiKey] = React.useState(() => localStorage.getItem("pharm_ckd_claude_key") || "");
  const [keyInput, setKeyInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  function saveKey() {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem("pharm_ckd_claude_key", k);
    setApiKey(k);
    setKeyInput("");
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const drpLabels = (rec.drps || []).map((k) => DRP_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
    const intLabels = (rec.interventions || []).map((k) => INTERVENTION_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
    const medList = (rec.meds || []).map((m) => `${m.drug} ${m.strength} (${m.dose || "–"})`).join(", ") || "ไม่มีรายการยา";
    const otcItems = rec.otcHerbal ? (rec.otcDetail || "มีสมุนไพร/ยานอก") : "ไม่มี";
    const drpText = drpLabels.length ? drpLabels.join(", ") : "ไม่พบ";
    const intText = intLabels.length ? intLabels.join(", ") : "ไม่มี";
    const outcomeText = rec.outcome === "accepted" ? "แก้ไขแล้ว" : rec.outcome === "not_accepted" ? `ยังไม่แก้ไข — ${rec.outcomeReason || ""}` : "ไม่ระบุ";

    const prompt = `คุณคือเภสัชกรผู้เชี่ยวชาญด้าน CKD สรุป BPML ต่อไปนี้เป็นข้อความสั้น ชัดเจน สำหรับแพทย์ผู้ดูแล ไม่เกิน 5 bullet points ภาษาไทย:

ผู้ป่วย: ${patient.name} อายุ ${patient.age} ปี HN ${patient.hn}
CKD ระยะ ${rec.ckdStage} eGFR ${rec.egfr || "–"} K⁺ ${rec.k || "–"}
รายการยา: ${medList}
สมุนไพร/OTC: ${otcItems}
DRP ที่พบ: ${drpText}
การแทรกแซง: ${intText}
ผล: ${outcomeText}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (resp.status === 401) throw new Error("API key ไม่ถูกต้อง (401 Unauthorized)");
      if (resp.status === 429) throw new Error("Rate limit — กรุณารอสักครู่แล้วลองใหม่");
      if (!resp.ok) throw new Error(`เกิดข้อผิดพลาด HTTP ${resp.status}`);
      const data = await resp.json();
      setResult(data.content?.[0]?.text || "ไม่มีข้อความตอบกลับ");
    } catch (e) {
      if (e.name === "TypeError") setError("ไม่สามารถเชื่อมต่อเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
      else setError(e.message);
    }
    setLoading(false);
  }

  function copyToClipboard() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div className="modal-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 560, boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>สรุป BPML สำหรับแพทย์ (AI)</span>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Icon name="x" size={20} color="var(--ink-2)" /></button>
        </div>

        <div style={{ padding: "22px 24px" }}>
          {/* API key entry if no key stored */}
          {!apiKey && (
            <div style={{ marginBottom: 18, padding: "14px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>กรุณาใส่ Claude API Key</div>
              <div style={{ fontSize: 12.5, color: "#92400e", marginBottom: 10 }}>ต้องการ Anthropic API Key เพื่อใช้งาน AI สรุป จะเก็บไว้ใน localStorage ของเครื่องนี้เท่านั้น</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "monospace", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                />
                <button onClick={saveKey} style={{ padding: "9px 16px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>บันทึก</button>
              </div>
            </div>
          )}

          {apiKey && (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#16a34a" }} />
              <span>ใช้ API Key ที่บันทึกไว้</span>
              <button onClick={() => { localStorage.removeItem("pharm_ckd_claude_key"); setApiKey(""); }}
                style={{ marginLeft: "auto", fontSize: 11.5, color: "#b91c1c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "var(--sans)" }}>เปลี่ยน Key</button>
            </div>
          )}

          {/* Patient info summary */}
          <div style={{ padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12.5, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)" }}>{patient.name}</strong> · HN {patient.hn} · อายุ {patient.age} ปี · CKD ระยะ {rec.ckdStage} · eGFR {rec.egfr || "–"} · K⁺ {rec.k || "–"}
          </div>

          {/* Generate button */}
          {!result && !loading && (
            <button
              onClick={generate}
              disabled={!apiKey}
              style={{ width: "100%", padding: "12px", background: apiKey ? "#0d9488" : "var(--surface-2)", color: apiKey ? "#fff" : "var(--ink-2)", border: apiKey ? "none" : "1px solid var(--border)", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: apiKey ? "pointer" : "not-allowed", fontFamily: "var(--sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              🤖 สรุป AI สำหรับแพทย์
            </button>
          )}

          {/* Loading spinner */}
          {loading && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>กำลังสร้างสรุป AI...</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#b91c1c", fontSize: 13.5, display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14 }}>
              <Icon name="alert" size={16} color="#b91c1c" />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>เกิดข้อผิดพลาด</div>
                <div>{error}</div>
              </div>
            </div>
          )}
          {error && (
            <button onClick={generate} disabled={!apiKey} style={{ padding: "9px 18px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" }}>ลองใหม่</button>
          )}

          {/* Result */}
          {result && (
            <div>
              <div style={{ padding: "16px 18px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 14, color: "var(--ink)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 12 }}>{result}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyToClipboard} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", background: copied ? "#16a34a" : "#0d9488", color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" }}>
                  {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}
                </button>
                <button onClick={() => { setResult(null); setError(null); }} style={{ padding: "9px 16px", background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" }}>สร้างใหม่</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   DrugSafetyCard — ตรวจ DDI + ข้อห้าม/ปรับขนาดตามไต ของยาใน visit นี้
   ใช้ checkDDI / checkContraindicated / checkDoseAdjustment จาก drp_engine
   ========================================================================= */
function DrugSafetyCard({ rec }) {
  const sevMeta = {
    major:    { c:"#b91c1c", bg:"#fef2f2", bd:"#fca5a5", label:"รุนแรง" },
    moderate: { c:"#b45309", bg:"#fffbeb", bd:"#fcd34d", label:"ปานกลาง" },
    minor:    { c:"#1d4ed8", bg:"#eff6ff", bd:"#bfdbfe", label:"เล็กน้อย" },
  };
  const sevRank = { major:0, moderate:1, minor:2 };

  const drugNames = [
    ...(rec.meds || []).map((m) => m.drug),
    ...(rec.otcItems || []).map((o) => o.name),
  ].filter((d) => d && d.trim());

  const ddi = (typeof checkDDI === "function") ? checkDDI(drugNames) : [];

  // ข้อห้ามใช้ / ต้องปรับขนาดตาม eGFR (ต่อยา)
  const renalFlags = [];
  (rec.meds || []).forEach((m) => {
    if (!m.drug || !m.drug.trim()) return;
    const ci = (typeof checkContraindicated === "function") ? checkContraindicated(m.drug, rec.egfr) : null;
    const da = (typeof checkDoseAdjustment === "function") ? checkDoseAdjustment(m.drug, rec.egfr) : null;
    if (ci) renalFlags.push({ drug: m.drug, severity: ci.level === "contraindicated" ? "major" : "moderate", kind: ci.level === "contraindicated" ? "ห้ามใช้" : "ระวัง", message: ci.message });
    else if (da) renalFlags.push({ drug: m.drug, severity: da.level === "avoid" ? "major" : "moderate", kind: da.level === "avoid" ? "ควรเลี่ยง" : "ปรับขนาด", message: da.message });
  });

  const total = ddi.length + renalFlags.length;
  ddi.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  renalFlags.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  if (drugNames.length < 1) return null;

  return (
    <DetailCard title={`ตรวจความปลอดภัยของยา${total ? ` · พบ ${total} ประเด็น` : ""}`} icon="shield">
      {total === 0 ? (
        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 12px", background:"#f0fdf4",
          border:"1px solid #bbf7d0", borderRadius:10, fontSize:13, color:"#15803d", fontWeight:600 }}>
          <span style={{ fontSize:17 }}>✅</span> ไม่พบอันตรกิริยาหรือข้อห้ามใช้ตามฐานข้อมูล ({drugNames.length} รายการยา)
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {/* ข้อห้าม/ปรับขนาดตามไต */}
          {renalFlags.map((f, i) => {
            const m = sevMeta[f.severity];
            return (
              <div key={"renal"+i} style={{ border:`1px solid ${m.bd}`, background:m.bg, borderRadius:11, padding:"10px 13px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:m.c, padding:"2px 8px", borderRadius:99 }}>{f.kind}</span>
                  <span style={{ fontSize:13.5, fontWeight:700, color:m.c }}>{f.drug}</span>
                  <span style={{ fontSize:11, color:"var(--ink-2)" }}>· eGFR {rec.egfr || "?"}</span>
                </div>
                <div style={{ fontSize:12.5, color:"var(--ink)", lineHeight:1.5 }}>{f.message}</div>
              </div>
            );
          })}
          {/* Drug–Drug Interactions */}
          {ddi.map((d, i) => {
            const m = sevMeta[d.severity];
            return (
              <div key={"ddi"+i} style={{ border:`1px solid ${m.bd}`, background:m.bg, borderRadius:11, padding:"10px 13px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:m.c, padding:"2px 8px", borderRadius:99 }}>{m.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:m.c }}>{d.drugA}</span>
                  <span style={{ fontSize:12, color:"var(--ink-2)" }}>✕</span>
                  <span style={{ fontSize:13, fontWeight:700, color:m.c }}>{d.drugB}</span>
                </div>
                <div style={{ fontSize:12.5, color:"var(--ink)", lineHeight:1.5 }}>{d.message}</div>
              </div>
            );
          })}
          <div style={{ fontSize:11, color:"var(--ink-2)", marginTop:2 }}>
            * ตรวจอัตโนมัติจากฐานข้อมูล DDI/CKD — โปรดใช้วิจารณญาณทางคลินิกประกอบเสมอ
          </div>
        </div>
      )}
    </DetailCard>
  );
}

/* =========================================================================
   InterventionTimeline — ไทม์ไลน์การแทรกแซงและผลลัพธ์ข้าม visit ทั้งหมด
   ========================================================================= */
function InterventionTimeline({ history }) {
  const chrono = [...history].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const visits = chrono.filter((v) => (v.interventions || []).length > 0 || v.outcome || (v.drps || []).length > 0 || v.counselingNote);
  const outcomeIcon = (o) => o === "accepted" ? "✅" : o === "not_accepted" ? "❌" : "⏳";
  const outcomeText = (v) => {
    if (v.outcome === "accepted") return "แก้ไขแล้ว";
    if (v.outcome === "not_accepted") return `ยังไม่แก้ไข${v.outcomeReason ? ` — ${v.outcomeReason}` : ""}`;
    return null;
  };
  if (!visits.length) return (
    <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--ink-2)" }}>
      <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
      <div style={{ fontWeight:700, fontSize:15 }}>ยังไม่มีบันทึกการแทรกแซง</div>
      <div style={{ fontSize:13, marginTop:6 }}>ข้อมูลจะปรากฏเมื่อมีการบันทึก DRP หรือ Intervention ใน visit ถัดไป</div>
    </div>
  );
  return (
    <div style={{ padding:"4px 0" }}>
      <div style={{ fontWeight:700, fontSize:14, color:"var(--ink)", marginBottom:16 }}>
        ประวัติการแทรกแซง {visits.length} visit
      </div>
      <div style={{ position:"relative" }}>
        {/* vertical line */}
        <div style={{ position:"absolute", left:19, top:0, bottom:0, width:2, background:"var(--border)", borderRadius:2 }} />
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[...visits].reverse().map((v, i) => {
            const intLabels = (v.interventions || []).map((k) => (typeof INTERVENTION_OPTIONS!=="undefined"?INTERVENTION_OPTIONS:[]).find((o)=>o.key===k)?.th).filter(Boolean);
            const drpLabels = (v.drps || []).map((k) => (typeof DRP_OPTIONS!=="undefined"?DRP_OPTIONS:[]).find((o)=>o.key===k)?.th).filter(Boolean);
            const outcome = outcomeText(v);
            const egfr = v.egfr ? parseFloat(v.egfr) : null;
            return (
              <div key={v.id} style={{ display:"flex", gap:12, animation:`fadeUp 0.25s ease-out ${i*0.04}s both` }}>
                {/* dot */}
                <div style={{ width:40, flexShrink:0, display:"flex", justifyContent:"center", paddingTop:2 }}>
                  <div style={{ width:14, height:14, borderRadius:99, background: v.outcome==="accepted"?"#16a34a": v.outcome==="not_accepted"?"#dc2626":"var(--brand)", border:"2px solid var(--surface)", boxShadow:`0 0 0 3px ${v.outcome==="accepted"?"#bbf7d0":v.outcome==="not_accepted"?"#fecaca":"var(--brand-soft)"}`, zIndex:1 }} />
                </div>
                {/* content */}
                <div style={{ flex:1, padding:"12px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, marginBottom:2 }} className="card-lift">
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"var(--ink)" }}>{fmtDate(v.date)}</div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      {egfr && <span style={{ fontFamily:"var(--mono)", fontSize:12, color: egfr<30?"#dc2626":egfr<60?"#d97706":"#16a34a", fontWeight:700 }}>eGFR {egfr}</span>}
                      {v.pharmacist && <span style={{ fontSize:11.5, color:"var(--ink-2)" }}>โดย {v.pharmacist}</span>}
                    </div>
                  </div>
                  {drpLabels.length > 0 && (
                    <div style={{ marginBottom:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {drpLabels.map((l,j) => <span key={j} style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:"#fef2f2", color:"#b91c1c", border:"1px solid #fca5a5", fontWeight:600 }}>⚠️ {l}</span>)}
                    </div>
                  )}
                  {intLabels.length > 0 && (
                    <div style={{ marginBottom:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {intLabels.map((l,j) => <span key={j} style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:"var(--brand-soft)", color:"var(--brand-deep)", border:"1px solid var(--brand)44", fontWeight:600 }}>→ {l}</span>)}
                    </div>
                  )}
                  {v.counselingNote && <div style={{ fontSize:12.5, color:"var(--ink-2)", fontStyle:"italic", marginBottom:6 }}>"{v.counselingNote}"</div>}
                  {outcome && (
                    <div style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:700,
                      color: v.outcome==="accepted"?"#15803d":"#b91c1c" }}>
                      {outcomeIcon(v.outcome)} {outcome}
                    </div>
                  )}
                  {!outcome && !intLabels.length && !drpLabels.length && (
                    <div style={{ fontSize:12, color:"var(--ink-2)" }}>บันทึก visit (ไม่มีการแทรกแซง)</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MedTimelineCard — ไทม์ไลน์การเปลี่ยนแปลงรายการยาข้าม visit (med reconciliation)
   ใช้ diffMedLists เทียบ visit ที่ติดกัน
   ========================================================================= */
function MedTimelineCard({ history }) {
  const chrono = [...history].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (chrono.length < 2) return null;

  const baseCount = (chrono[0].meds || []).filter((m) => m.drug && m.drug.trim()).length;
  const steps = [];
  for (let i = 1; i < chrono.length; i++) {
    steps.push({ visit: chrono[i], diff: diffMedLists(chrono[i - 1].meds || [], chrono[i].meds || []) });
  }

  const dot = (color) => ({ width:11, height:11, borderRadius:99, background:color, flexShrink:0,
    boxShadow:`0 0 0 3px ${color}33`, marginTop:3 });
  const chip = (text, color, bg) => (
    <span style={{ fontSize:11.5, color, background:bg, border:`1px solid ${color}44`,
      padding:"2px 8px", borderRadius:7, fontWeight:600, display:"inline-block", margin:"2px 4px 2px 0" }}>{text}</span>
  );

  return (
    <DetailCard title="ไทม์ไลน์การเปลี่ยนแปลงยา" icon="clock">
      <div style={{ position:"relative", paddingLeft:6 }}>
        {/* baseline visit */}
        <div style={{ display:"flex", gap:12, paddingBottom:14, position:"relative" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={dot("var(--brand)")} />
            <div style={{ flex:1, width:2, background:"var(--border)", marginTop:2 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{fmtDate(chrono[0].date)} <span style={{ fontSize:11, fontWeight:500, color:"var(--ink-2)" }}>· เริ่มต้น</span></div>
            <div style={{ fontSize:12, color:"var(--ink-2)", marginTop:2 }}>มียา {baseCount} รายการ</div>
          </div>
        </div>
        {steps.map((s, i) => {
          const { added, stopped, changed, unchanged } = s.diff;
          const noChange = !added.length && !stopped.length && !changed.length;
          const isLast = i === steps.length - 1;
          return (
            <div key={s.visit.id} style={{ display:"flex", gap:12, paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={dot(noChange ? "#94a3b8" : "#d97706")} />
                {!isLast && <div style={{ flex:1, width:2, background:"var(--border)", marginTop:2 }} />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{fmtDate(s.visit.date)}</div>
                {noChange ? (
                  <div style={{ fontSize:12, color:"var(--ink-2)", marginTop:3 }}>ไม่มีการเปลี่ยนแปลงรายการยา ({unchanged} รายการคงเดิม)</div>
                ) : (
                  <div style={{ marginTop:4 }}>
                    {added.map((m, j) => <React.Fragment key={"a"+j}>{chip(`+ เริ่ม ${m.drug}${m.strength ? " "+m.strength : ""}`, "#16a34a", "#f0fdf4")}</React.Fragment>)}
                    {stopped.map((m, j) => <React.Fragment key={"s"+j}>{chip(`− หยุด ${m.drug}`, "#dc2626", "#fef2f2")}</React.Fragment>)}
                    {changed.map((c, j) => <React.Fragment key={"c"+j}>{chip(`✎ ${c.drug}: ${c.from || "?"} → ${c.to || "?"}`, "#b45309", "#fffbeb")}</React.Fragment>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DetailCard>
  );
}

/* ---------- CareGoalsPanel ---------- */
function CareGoalsPanel({ hn }) {
  const KEY = `ckd_goals_${hn}`;
  const [goals, setGoals] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null") || { egfr:"", bp:"", k:"", notes:"" }; }
    catch(e) { return { egfr:"", bp:"", k:"", notes:"" }; }
  });
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(goals);

  function save() {
    setGoals(draft);
    localStorage.setItem(KEY, JSON.stringify(draft));
    setEditing(false);
  }

  const hasGoals = goals.egfr || goals.bp || goals.k || goals.notes;

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
      padding:"14px 18px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: hasGoals && !editing ? 12 : 0 }}>
        <span style={{ fontSize:16 }}>🎯</span>
        <span style={{ fontSize:14, fontWeight:700, color:"var(--ink)", flex:1 }}>เป้าหมายการรักษา</span>
        <button onClick={() => { setDraft(goals); setEditing(e => !e); }}
          style={{ fontSize:12, padding:"4px 10px", borderRadius:8, border:"1px solid var(--border)",
            background:"var(--surface-2)", cursor:"pointer", fontWeight:600, fontFamily:"var(--sans)",
            color:"var(--ink-2)" }}>
          {editing ? "ยกเลิก" : "แก้ไข"}
        </button>
      </div>
      {editing ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
          {[["egfr","เป้า eGFR","เช่น ≥ 25 mL/min"],["bp","เป้า BP","เช่น < 130/80 mmHg"],["k","เป้า K⁺","เช่น 3.5–5.0 mmol/L"]].map(([k,label,ph]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:12, fontWeight:600, color:"var(--ink-2)", width:80, flexShrink:0 }}>{label}</span>
              <input value={draft[k]} onChange={e => setDraft(d => ({...d, [k]: e.target.value}))}
                placeholder={ph}
                style={{ flex:1, padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)",
                  fontFamily:"var(--sans)", fontSize:13, background:"var(--surface)", color:"var(--ink)" }} />
            </div>
          ))}
          <div>
            <span style={{ fontSize:12, fontWeight:600, color:"var(--ink-2)" }}>หมายเหตุ</span>
            <textarea value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))}
              placeholder="แผนการรักษาหรือหมายเหตุเพิ่มเติม"
              rows={2}
              style={{ width:"100%", marginTop:4, padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)",
                fontFamily:"var(--sans)", fontSize:13, resize:"vertical", background:"var(--surface)", color:"var(--ink)" }} />
          </div>
          <button onClick={save}
            style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--brand)",
              color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"var(--sans)",
              alignSelf:"flex-start" }}>
            บันทึกเป้าหมาย
          </button>
        </div>
      ) : hasGoals ? (
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:10 }}>
          {[["egfr","eGFR"],["bp","BP"],["k","K⁺"]].filter(([k]) => goals[k]).map(([k, label]) => (
            <div key={k} style={{ padding:"6px 12px", borderRadius:9, background:"var(--brand-soft)",
              border:"1px solid rgba(13,148,136,.25)" }}>
              <span style={{ fontSize:10.5, color:"var(--brand-deep)", fontWeight:600 }}>{label} </span>
              <span style={{ fontSize:13, fontWeight:800, color:"var(--ink)", fontFamily:"var(--mono)" }}>{goals[k]}</span>
            </div>
          ))}
          {goals.notes && <div style={{ fontSize:12.5, color:"var(--ink-2)", fontStyle:"italic", alignSelf:"center" }}>{goals.notes}</div>}
        </div>
      ) : (
        <div style={{ fontSize:12.5, color:"var(--ink-2)", marginTop:8 }}>
          ยังไม่ได้ตั้งเป้าหมาย — กด "แก้ไข" เพื่อเพิ่ม
        </div>
      )}
    </div>
  );
}

/* ---------- รายละเอียด + ประวัติ ---------- */
function PatientDetail({ hn, records, user, onBack, onEdit, onNew, onDelete }) {
  const history = records.filter((r) => r.hn === hn).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const [selId, setSelId] = React.useState(() => history[0]?.id || null);
  const [activeTab, setActiveTab] = React.useState("detail");
  const [printOpen, setPrintOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [lineOpen, setLineOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  // A3: navigate back when all visits are deleted (must be before any conditional return)
  React.useEffect(() => { if (!history.length) onBack && onBack(); }, [history.length]);

  // ALL hooks must run before this early return (Rules of Hooks)
  if (!history.length) return null;
  const cur = history[0];
  const risk = computeRisk(cur);
  const rec = history.find((r) => r.id === selId) || cur;
  const rRisk = computeRisk(rec);

  const drpLabels = (rec.drps || []).map((k) => DRP_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
  const srcLabels = (rec.sources || []).map((k) => SOURCE_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);
  const intLabels = (rec.interventions || []).map((k) => INTERVENTION_OPTIONS.find((o) => o.key === k)?.th).filter(Boolean);

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1100, margin: "0 auto" }}>
      {printOpen && <PrintModal rec={rec} patient={cur} onClose={() => setPrintOpen(false)} />}
      {aiOpen && <AiSummaryModal rec={rec} patient={cur} onClose={() => setAiOpen(false)} />}
      {lineOpen && <LineReminderModal rec={rec} patient={cur} onClose={() => setLineOpen(false)} />}
      {deleteTarget && <ConfirmDeleteModal rec={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={(reason) => { setDeleteTarget(null); onDelete(deleteTarget, reason); }} />}
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 16 }}><Icon name="chevron" size={16} color="var(--ink-2)" />กลับ</button>

      {/* header */}
      <div className="card-modern" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {/* แถวบน: actions หลัก */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => setAiOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>🤖 AI สรุป</button>
              <button onClick={() => setLineOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>💬 LINE</button>
              <button onClick={() => onNew(cur)} style={{ ...primaryBtn, whiteSpace: "nowrap" }}><Icon name="plus" size={15} color="#fff" />Visit ใหม่</button>
            </div>
            {/* แถวล่าง: secondary actions */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => setPrintOpen(true)} style={ghostBtn}><Icon name="download" size={14} />PDF</button>
              <button onClick={() => onEdit(rec)} style={ghostBtn}><Icon name="edit" size={14} />แก้ไข</button>
              <button onClick={() => setDeleteTarget(rec)} style={{ ...ghostBtn, color:"#dc2626", borderColor:"#fca5a5" }}>
                <Icon name="x" size={14} color="#dc2626" />ลบ Visit
              </button>
            </div>
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

      {/* Tab switcher with sliding indicator */}
      {(() => {
        const tabs = [["detail","รายละเอียด","list"],["trend","แนวโน้ม & เปรียบเทียบ","trend"],["timeline","ประวัติการแทรกแซง","clock"]];
        const activeIdx = tabs.findIndex(([v]) => v === activeTab);
        const pct = 100 / tabs.length;
        return (
          <div className="tab-slide-wrap" style={{ display:"flex", gap:0, marginBottom:14,
            background:"var(--surface-2)", borderRadius:13, padding:4 }}>
            <div className="tab-slide-pill" style={{
              width:`calc(${pct}% - 2.7px)`,
              transform:`translateX(calc(${activeIdx} * (100% + ${4/tabs.length}px)))`,
              left:4,
            }} />
            {tabs.map(([v,t,ic]) => (
              <button key={v} onClick={() => setActiveTab(v)}
                style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                  padding:"9px 12px", borderRadius:9, border:"none", background:"transparent",
                  color: activeTab===v ? "var(--brand-deep)" : "var(--ink-2)",
                  fontSize:13.5, fontWeight: activeTab===v ? 700 : 500,
                  cursor:"pointer", fontFamily:"var(--sans)", position:"relative", zIndex:1,
                  transition:"color 0.2s" }}>
                <Icon name={ic} size={15} color={activeTab===v?"var(--brand)":"currentColor"} />{t}
                {v==="trend" && history.length>1 && (
                  <span style={{ background: activeTab===v ? "var(--brand-soft)" : "var(--border)",
                    color: activeTab===v ? "var(--brand-deep)" : "var(--ink-2)",
                    fontSize:10.5, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>
                    {history.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })()}

      <div key={activeTab} style={{ animation: "fadeUp 0.26s ease-out both" }}>
      {activeTab === "trend" ? (
        <TrendPanel history={history} onSelectVisit={(id) => { setSelId(id); setActiveTab("detail"); }} />
      ) : activeTab === "timeline" ? (
        <InterventionTimeline history={history} />
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
          <CareGoalsPanel hn={hn} />
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

          <DetailCard title={`รายการยา (BPML) · ${(rec.meds || []).length} รายการ`} icon="pill">
            {(rec.meds || []).length ? (rec.meds || []).map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: i < (rec.meds || []).length - 1 ? "1px solid var(--border)" : "none" }}>
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

          <DrugSafetyCard rec={rec} />

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

          <MedTimelineCard history={history} />
        </div>
      </div>
      )} {/* end activeTab===detail */}
      </div>
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

// fmtDate and TH_MONTHS defined in data.jsx

Object.assign(window, { PatientsList, PatientDetail, AiSummaryModal, LineReminderModal, fmtDate, DeleteLogPage });
