/* =========================================================================
   form.jsx — แบบบันทึก BPML v2
   ใหม่: HN auto-fill, copy last visit, quick dose builder, recent drugs
   ========================================================================= */

/* ---------- ยาที่ใช้บ่อย (recent drugs tracker) ---------- */
const RECENT_KEY = "pharm_ckd_recent_drugs_v1";
const RecentDrugs = {
  get() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; } },
  record(name) {
    if (!name) return;
    const list = this.get().filter((x) => x !== name);
    list.unshift(name);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20)));
  },
  sorted(q) {
    const rec = this.get();
    const all = DRUG_DB.map((d) => d.name);
    if (!q || q.length < 1) return rec.map((n) => DRUG_DB.find((d) => d.name === n)).filter(Boolean).slice(0, 6);
    const ql = q.toLowerCase();
    const match = all.filter((n) => n.toLowerCase().includes(ql));
    // recent ที่ match ขึ้นก่อน
    const recMatch = rec.filter((n) => match.includes(n));
    const rest = match.filter((n) => !rec.includes(n));
    return [...recMatch, ...rest].slice(0, 8).map((n) => DRUG_DB.find((d) => d.name === n)).filter(Boolean);
  },
};

/* ---------- Quick Dose Builder ---------- */
const FREQ_OPTS = ["1x1", "1x2", "1x3", "2x1", "2x2", "stat"];
const TIME_OPTS = [
  { v: "pc", t: "pc (หลังอาหาร)" }, { v: "ac", t: "ac (ก่อนอาหาร)" },
  { v: "hs", t: "hs (ก่อนนอน)" }, { v: "prn", t: "prn (เมื่อมีอาการ)" },
  { v: "เช้า", t: "เช้า" }, { v: "เย็น", t: "เย็น" },
];
const QUICK_PRESETS = [
  "1x1 pc", "1x2 pc", "1x3 pc", "1x1 ac", "1x1 hs", "1x2 hs",
  "2x1 pc", "2x2 pc", "1x1 เช้า", "prn", "stat", "ตามแพทย์สั่ง",
];

function DoseBuilder({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [freq, setFreq] = React.useState("");
  const [time, setTime] = React.useState("");
  const triggerRef = React.useRef(null);
  const popRef = React.useRef(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 310, maxH: 440 });

  function openPop() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const estHeight = 440;
      const spaceBelow = window.innerHeight - r.bottom;
      const goUp = spaceBelow < estHeight && r.top > estHeight;
      setPos({
        top: goUp ? r.top - estHeight - 6 : r.bottom + 6,
        left: r.left,
        width: Math.max(r.width, 310),
        maxH: Math.min(estHeight, goUp ? r.top - 12 : spaceBelow - 12),
      });
    }
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (popRef.current && !popRef.current.contains(e.target) && triggerRef.current && !triggerRef.current.contains(e.target))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function applyPreset(p) { onChange(p); setOpen(false); setFreq(""); setTime(""); }
  function applyCombo() {
    if (freq) { onChange(freq + (time ? " " + time : "")); setOpen(false); setFreq(""); setTime(""); }
  }

  return (
    <div ref={triggerRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <input style={{ ...inS, flex: 1 }} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="1x2 pc / พิมพ์เอง..." />
        <button type="button" onClick={() => open ? setOpen(false) : openPop()} title="Quick fill"
          style={{ padding: "0 11px", border: "1px solid var(--border)", borderRadius: 8, background: open ? "var(--brand-soft)" : "var(--surface)", cursor: "pointer", color: "var(--brand-deep)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name="list" size={16} />
        </button>
      </div>
      {open && (
        <div ref={popRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 310), maxHeight: pos.maxH || 440, overflowY: "auto", zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 10px 36px rgba(0,0,0,.18)", padding: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>วิธีใช้ที่พบบ่อย</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {QUICK_PRESETS.map((p) => (
              <button key={p} type="button" onMouseDown={() => applyPreset(p)}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${value === p ? "var(--brand)" : "var(--border)"}`, background: value === p ? "var(--brand-soft)" : "var(--surface)", color: value === p ? "var(--brand-deep)" : "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 7 }}>หรือสร้างเอง</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              {FREQ_OPTS.map((f) => (
                <button key={f} type="button" onMouseDown={(e) => { e.preventDefault(); setFreq(f === freq ? "" : f); }}
                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${freq === f ? "var(--brand)" : "var(--border)"}`, background: freq === f ? "var(--brand)" : "var(--surface)", color: freq === f ? "#fff" : "var(--ink)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" }}>{f}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {TIME_OPTS.map((o) => (
                <button key={o.v} type="button" onMouseDown={(e) => { e.preventDefault(); setTime(o.v === time ? "" : o.v); }}
                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${time === o.v ? "var(--accent)" : "var(--border)"}`, background: time === o.v ? "var(--brand-soft)" : "var(--surface)", color: time === o.v ? "var(--brand-deep)" : "var(--ink-2)", fontSize: 12, cursor: "pointer", fontFamily: "var(--sans)" }}>{o.t}</button>
              ))}
            </div>
            {freq && <button type="button" onMouseDown={applyCombo}
              style={{ width: "100%", padding: "9px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" }}>
              ใส่: {freq}{time ? " " + time : ""}
            </button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- แบบฟอร์มหลัก ---------- */
function blankMed() { return { drug: "", strength: "", dose: "", actuallyTaking: "", source: "", remark: "", flags: [] }; }

function BpmlForm({ initial, user, records = [], onSave, onCancel }) {
  const [f, setF] = React.useState(() => initial ? JSON.parse(JSON.stringify(initial)) : {
    hn: "", name: "", age: "", ckdStage: "", date: "2026-05-29", scr: "", egfr: "", k: "", na: "",
    bpSys: "", bpDia: "", hr: "", allergy: "", sources: [], sourceOther: "",
    meds: [blankMed()], otcHerbal: false, otcDetail: "", drps: [], drpDetail: "",
    comparedPrev: false, comparedNew: false, discrepancy: "none", discrepancyType: "",
    interventions: [], counselingNote: "", outcome: "", outcomeReason: "", physician: "",
    pharmacist: user.name, pharmacistId: user.id, time: "", followUp: null,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k, val) => setF((p) => ({ ...p, [k]: (p[k] || []).includes(val) ? p[k].filter((x) => x !== val) : [...(p[k] || []), val] }));

  const [openRecon, setOpenRecon] = React.useState(!!(initial?.discrepancy === "found"));
  const [openFollow, setOpenFollow] = React.useState(!!(initial?.followUp));
  const [hnSuggest, setHnSuggest] = React.useState(null); // {rec} last visit for this HN

  // HN lookup — เมื่อกรอก HN ค้นหา visit ล่าสุด
  function onHnChange(hn) {
    set("hn", hn);
    if (hn.trim().length >= 4) {
      const prev = records.filter((r) => r.hn === hn.trim() && r.id !== initial?.id)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setHnSuggest(prev[0] || null);
    } else { setHnSuggest(null); }
  }

  // เติมข้อมูลผู้ป่วยจาก visit ล่าสุด
  function fillFromPrev() {
    if (!hnSuggest) return;
    setF((p) => ({ ...p,
      name: hnSuggest.name || p.name,
      age: hnSuggest.age || p.age,
      ckdStage: hnSuggest.ckdStage || p.ckdStage,
      allergy: hnSuggest.allergy || p.allergy,
      physician: hnSuggest.physician || p.physician,
    }));
    setHnSuggest(null);
  }

  // Visit picker state
  const [showVisitPicker, setShowVisitPicker] = React.useState(false);
  const prevVisits = React.useMemo(() => records
    .filter((r) => r.hn === f.hn.trim() && r.id !== initial?.id && (r.meds?.length > 0 || r.ckdStage))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")), [records, f.hn, initial]);

  function copyFromVisit(r) {
    if (r.meds?.length) setF((p) => ({ ...p, meds: r.meds.map((m) => ({ ...m })) }));
    setShowVisitPicker(false);
  }
  function fillPatientFromVisit(r) {
    setF((p) => ({ ...p, name: r.name || p.name, age: r.age || p.age, ckdStage: r.ckdStage || p.ckdStage, allergy: r.allergy || p.allergy, physician: r.physician || p.physician }));
  }

  const risk = computeRisk(f);

  // med ops
  const setMed = (i, k, v) => setF((p) => { const m = [...p.meds]; m[i] = { ...m[i], [k]: v }; return { ...p, meds: m }; });
  const pickDrug = (i, d) => {
    RecentDrugs.record(d.name);
    setF((p) => {
      const m = [...p.meds];
      m[i] = { ...m[i], drug: d.name, strength: d.strengths[0] || m[i].strength || "", flags: d.flags };
      return { ...p, meds: m };
    });
  };
  const addMed = () => setF((p) => ({ ...p, meds: [...p.meds, blankMed()] }));
  const delMed = (i) => setF((p) => ({ ...p, meds: p.meds.filter((_, j) => j !== i) }));

  function save() {
    const rec = { ...f, riskScore: risk.score, riskBand: risk.band };
    if (!rec.createdBy) rec.createdBy = user.id;
    rec.meds = rec.meds.filter((m) => m.drug.trim());
    rec.meds.forEach((m) => RecentDrugs.record(m.drug));
    onSave(rec);
  }
  const valid = f.hn.trim() && f.name.trim() && f.ckdStage;

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1080, margin: "0 auto" }}>
        <PageHead
          title={initial ? "แก้ไขแบบบันทึก BPML" : "แบบบันทึก BPML ใหม่"}
          sub="Best Possible Medication List & Medication Reconciliation"
          action={<button onClick={onCancel} style={ghostBtn}><Icon name="x" size={16} />ยกเลิก</button>}
        />

        {/* ส่วนที่ 1 */}
        <FSection n="1" title="ข้อมูลผู้ป่วย" en="Patient Information" defaultOpen lockOpen>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,160px) 1fr 90px", gap: 12, alignItems: "start" }} className="pinfo-row">
            <div>
              <MiniLabel>HN <span style={{ color: "#dc2626" }}>*</span></MiniLabel>
              <input style={inS} value={f.hn} onChange={(e) => onHnChange(e.target.value)} placeholder="66xxxxx" />
            </div>
            <Field label="ชื่อ-สกุล" en="Name" req><input style={inS} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="อายุ" en="Age"><input style={inS} value={f.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" /></Field>
          </div>

          {/* HN suggest banner */}
          {hnSuggest && (
            <div style={{ marginTop: 10, padding: "11px 14px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Icon name="user" size={18} color="var(--brand-deep)" />
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>
                พบผู้ป่วย: <strong>{hnSuggest.name}</strong> · CKD {hnSuggest.ckdStage} · visit ล่าสุด {fmtDate(hnSuggest.date)}
              </span>
              <button type="button" onClick={fillFromPrev} style={{ ...ghostBtn, background: "var(--brand)", color: "#fff", border: "none", fontSize: 13 }}>
                <Icon name="check" size={14} color="#fff" />เติมข้อมูล
              </button>
              <button type="button" onClick={() => setHnSuggest(null)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={16} color="var(--ink-2)" /></button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Field label="CKD stage" req>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CKD_STAGES.map((s) => (
                  <button key={s} type="button" onClick={() => set("ckdStage", s)}
                    style={{ flex: "1 1 60px", maxWidth: 110, padding: "10px 0", border: `1px solid ${f.ckdStage === s ? "var(--brand)" : "var(--border)"}`, background: f.ckdStage === s ? "var(--brand)" : "var(--surface)", color: f.ckdStage === s ? "#fff" : "var(--ink-2)", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" }}>{s}</button>
                ))}
              </div>
            </Field>
          </div>
          <div style={{ ...fGrid, marginTop: 12 }}>
            <Field label="วันที่" en="Date" w={150}><input type="date" style={inS} value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Scr" unit="mg/dL" w={100}><input style={inS} value={f.scr} onChange={(e) => set("scr", e.target.value)} inputMode="decimal" /></Field>
            <Field label="eGFR" unit="mL/min" w={110}><input style={{ ...inS, borderColor: f.egfr && Number(f.egfr) < 30 ? "#fca5a5" : undefined }} value={f.egfr} onChange={(e) => set("egfr", e.target.value)} inputMode="decimal" /></Field>
            <Field label="K⁺" unit="mmol/L" w={100}><input style={{ ...inS, borderColor: f.k && (Number(f.k) > 5.5 || Number(f.k) < 3.5) ? "#fca5a5" : undefined }} value={f.k} onChange={(e) => set("k", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Na⁺" unit="mmol/L" w={100}><input style={inS} value={f.na} onChange={(e) => set("na", e.target.value)} inputMode="decimal" /></Field>
            <Field label="BP" unit="mmHg" w={130}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input style={{ ...inS, textAlign: "center" }} value={f.bpSys} onChange={(e) => set("bpSys", e.target.value)} inputMode="numeric" placeholder="ตัวบน" />
                <span style={{ color: "var(--ink-2)" }}>/</span>
                <input style={{ ...inS, textAlign: "center" }} value={f.bpDia} onChange={(e) => set("bpDia", e.target.value)} inputMode="numeric" placeholder="ตัวล่าง" />
              </div>
            </Field>
            <Field label="HR" unit="/min" w={90}><input style={inS} value={f.hr} onChange={(e) => set("hr", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Allergy / ADR" grow><input style={inS} value={f.allergy} onChange={(e) => set("allergy", e.target.value)} placeholder="ระบุ หรือ -" /></Field>
          </div>
        </FSection>

        {/* ส่วนที่ 3 — BPML */}
        <FSection n="3" title="รายการยาที่ถูกต้องและเป็นปัจจุบันที่สุด" en="Best Possible Medication List" defaultOpen
          badge={f.meds.filter((m) => m.drug).length + " รายการ"}>

          {/* Visit picker */}
          {prevVisits.length > 0 && (
            <div style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 11, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="clock" size={16} color="var(--brand-deep)" />
                <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                  พบ {prevVisits.length} visit ก่อนหน้า — เลือกเพื่อนำข้อมูลมาใช้
                </span>
                <button type="button" onClick={() => setShowVisitPicker((o) => !o)}
                  style={{ ...ghostBtn, fontSize: 12.5, padding: "6px 12px", color: "var(--brand-deep)", borderColor: "var(--brand)" }}>
                  {showVisitPicker ? "ซ่อน" : "เลือก visit"} <Icon name={showVisitPicker ? "chevron" : "chevronR"} size={14} />
                </button>
              </div>
              {showVisitPicker && (
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {prevVisits.map((r, i) => {
                    const rk = computeRisk(r);
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: "1px solid var(--border)", background: i === 0 ? "var(--brand-soft)" : "var(--surface)", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13.5 }}>{fmtDate(r.date)}</span>
                            {i === 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand-deep)", background: "var(--brand-soft)", border: "1px solid var(--brand)", padding: "1px 7px", borderRadius: 99 }}>ล่าสุด</span>}
                            <StagePill stage={r.ckdStage} />
                            <RiskBadge band={rk.band} small />
                          </div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginTop: 4, display: "flex", gap: 14 }}>
                            <span style={{ color: parseFloat(r.egfr) < 30 ? "#b91c1c" : "var(--ink-2)" }}>eGFR {r.egfr || "–"}</span>
                            <span style={{ color: parseFloat(r.k) > 5.5 ? "#b91c1c" : "var(--ink-2)" }}>K⁺ {r.k || "–"}</span>
                            <span>BP {r.bpSys || "–"}/{r.bpDia || "–"}</span>
                            <span>{(r.meds || []).length} รายการยา</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 7 }}>
                          <button type="button" onClick={() => { fillPatientFromVisit(r); setShowVisitPicker(false); }}
                            style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px" }}>
                            <Icon name="user" size={13} />ข้อมูลผู้ป่วย
                          </button>
                          <button type="button" onClick={() => copyFromVisit(r)}
                            style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px", color: "var(--brand-deep)", borderColor: "var(--brand)" }}>
                            <Icon name="pill" size={13} />นำรายการยา
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {f.meds.map((m, i) => <MedRow key={i} i={i} m={m} setMed={setMed} pickDrug={pickDrug} del={() => delMed(i)} canDel={f.meds.length > 1} />)}
          </div>
          <button type="button" onClick={addMed} style={{ ...ghostBtn, marginTop: 12, borderStyle: "dashed", width: "100%", justifyContent: "center" }}>
            <Icon name="plus" size={16} /> เพิ่มรายการยา
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, fontSize: 13.5, color: "var(--ink)", cursor: "pointer" }}>
            <CheckBox on={f.otcHerbal} onClick={() => set("otcHerbal", !f.otcHerbal)} />
            มียานอก / สมุนไพร / อาหารเสริม <span style={{ color: "var(--ink-2)" }}>(OTC/Herbal/Supplement)</span>
          </label>
          {f.otcHerbal && <input style={{ ...inS, marginTop: 8 }} value={f.otcDetail} onChange={(e) => set("otcDetail", e.target.value)} placeholder="ระบุ เช่น ยาลูกกลอน, น้ำมันปลา..." />}
        </FSection>

        {/* ส่วนที่ 4 */}
        <FSection n="4" title="ประเมินความปลอดภัยด้านยาใน CKD" en="CKD Safety Screening" defaultOpen
          badge={f.drps.length ? f.drps.length + " ปัญหา" : null} badgeTone={f.drps.length ? "danger" : null}>
          <ChipGroup options={DRP_OPTIONS} selected={f.drps} onToggle={(k) => toggle("drps", k)} danger />
          {f.drps.length > 0 && (
            <Field label="รายละเอียดปัญหาด้านยา (DRP)" style={{ marginTop: 14 }}>
              <textarea style={{ ...inS, minHeight: 64, resize: "vertical" }} value={f.drpDetail} onChange={(e) => set("drpDetail", e.target.value)} placeholder="อธิบายปัญหาที่พบ..." />
            </Field>
          )}
        </FSection>

        {/* ส่วนที่ 2 */}
        <FSection n="2" title="แหล่งข้อมูลที่ใช้" en="Information Sources" badge={f.sources.length ? f.sources.length : null}>
          <ChipGroup options={SOURCE_OPTIONS} selected={f.sources} onToggle={(k) => toggle("sources", k)} />
          <Field label="อื่น ๆ" style={{ marginTop: 12 }}><input style={inS} value={f.sourceOther} onChange={(e) => set("sourceOther", e.target.value)} placeholder="ระบุแหล่งข้อมูลอื่น" /></Field>
        </FSection>

        {/* ส่วนที่ 5 */}
        <FSection n="5" title="Medication Reconciliation" en="การกระทบยอดรายการยา" open={openRecon} onToggle={() => setOpenRecon((o) => !o)}>
          <Field label="เปรียบเทียบกับ (Compared)">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <Check label="ใบสั่งยาเดิม (Previous order)" on={f.comparedPrev} onClick={() => set("comparedPrev", !f.comparedPrev)} />
              <Check label="ใบสั่งยาใหม่ (New order)" on={f.comparedNew} onClick={() => set("comparedNew", !f.comparedNew)} />
            </div>
          </Field>
          <Field label="พบความคลาดเคลื่อน (Discrepancy)" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[["none", "ไม่พบ"], ["found", "พบ"]].map(([v, t]) => (
                <button key={v} type="button" onClick={() => set("discrepancy", v)}
                  style={segBtn(f.discrepancy === v, v === "found")}>{t}</button>
              ))}
            </div>
          </Field>
          {f.discrepancy === "found" && (
            <>
              <Field label="ชนิดความคลาดเคลื่อน" style={{ marginTop: 12 }}><input style={inS} value={f.discrepancyType} onChange={(e) => set("discrepancyType", e.target.value)} /></Field>
              <Field label="การดำเนินการ (Intervention)" style={{ marginTop: 12 }}>
                <ChipGroup options={INTERVENTION_OPTIONS} selected={f.interventions} onToggle={(k) => toggle("interventions", k)} small />
              </Field>
              {f.interventions.includes("counsel") && <input style={{ ...inS, marginTop: 8 }} value={f.counselingNote} onChange={(e) => set("counselingNote", e.target.value)} placeholder="รายละเอียดการให้คำปรึกษา..." />}
              <Field label="ผลลัพธ์ (Outcome)" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["accepted", "แก้ไขแล้ว"], ["not_accepted", "ไม่แก้ไข"]].map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set("outcome", v)} style={segBtn(f.outcome === v, v === "not_accepted")}>{t}</button>
                  ))}
                </div>
              </Field>
              {f.outcome === "not_accepted" && <input style={{ ...inS, marginTop: 8 }} value={f.outcomeReason} onChange={(e) => set("outcomeReason", e.target.value)} placeholder="เหตุผลที่ไม่แก้ไข..." />}
              <Field label="แพทย์ (ชื่อ)" style={{ marginTop: 12 }}><input style={inS} value={f.physician} onChange={(e) => set("physician", e.target.value)} /></Field>
            </>
          )}
        </FSection>

        {/* นัดติดตาม */}
        <FSection n="•" title="นัดติดตามผู้ป่วย" en="Follow-up reminder" open={openFollow} onToggle={() => { const n = !openFollow; setOpenFollow(n); if (n && !f.followUp) set("followUp", { due: "", note: "" }); if (!n) set("followUp", null); }}>
          <div style={fGrid}>
            <Field label="วันที่นัดติดตาม" w={180}><input type="date" style={inS} value={f.followUp?.due || ""} onChange={(e) => set("followUp", { ...(f.followUp || {}), due: e.target.value })} /></Field>
            <Field label="หมายเหตุการติดตาม" grow><input style={inS} value={f.followUp?.note || ""} onChange={(e) => set("followUp", { ...(f.followUp || {}), note: e.target.value })} placeholder="เช่น ติดตามผล K⁺..." /></Field>
          </div>
        </FSection>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>
          <Icon name="user" size={18} color="var(--brand-deep)" />
          เภสัชกรผู้บันทึก: <strong style={{ color: "var(--ink)" }}>{f.pharmacist}</strong>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 12 }}>{f.time || "บันทึกเวลาอัตโนมัติ"}</span>
        </div>
      </div>

      {/* sticky bottom bar */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -6px 20px rgba(0,0,0,.05)", padding: "12px clamp(18px,2.4vw,30px)", zIndex: 20 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>ระดับความเสี่ยง</span>
            <RiskBadge band={risk.band} score={risk.score} />
            <span style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.3 }}>{risk.factors.slice(0, 2).map((x) => x.t).join(" · ") || "ยังไม่มีปัจจัยเสี่ยง"}</span>
          </div>
          <button onClick={save} disabled={!valid} style={{ ...primaryBtn, opacity: valid ? 1 : .45, cursor: valid ? "pointer" : "not-allowed" }}>
            <Icon name="check" size={18} color="#fff" /> บันทึกข้อมูล
          </button>
        </div>
        {!valid && <div style={{ maxWidth: 1080, margin: "6px auto 0", fontSize: 11.5, color: "#b45309" }}>กรอก HN, ชื่อ-สกุล และเลือก CKD stage เพื่อบันทึก</div>}
      </div>
    </div>
  );
}

/* ---------- Strength pill picker ---------- */
function StrengthPicker({ drug, value, onChange }) {
  const info = lookupDrug(drug);
  const options = info ? info.strengths : [];
  const [custom, setCustom] = React.useState(false);

  // If no options or user wants custom input
  if (!options.length || custom) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <input style={{ ...inS, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder="mg / mcg" />
        {options.length > 0 && <button type="button" onClick={() => setCustom(false)} title="กลับไปเลือก" style={{ border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", cursor: "pointer", padding: "0 8px", color: "var(--brand-deep)", fontSize: 11 }}>◀</button>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)}
            style={{ padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${value === s ? "var(--brand)" : "var(--border)"}`, background: value === s ? "var(--brand)" : "var(--surface)", color: value === s ? "#fff" : "var(--ink-2)", fontSize: 12.5, fontWeight: value === s ? 700 : 400, cursor: "pointer", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
            {s}
          </button>
        ))}
        <button type="button" onClick={() => setCustom(true)} title="พิมพ์เอง"
          style={{ padding: "7px 8px", borderRadius: 7, border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--ink-2)", fontSize: 11, cursor: "pointer" }}>✏️</button>
      </div>
    </div>
  );
}

/* ---------- Drug info card (แสดงข้อมูลยาสำหรับ CKD) ---------- */
function DrugInfoCard({ drug }) {
  const info = lookupDrug(drug);
  if (!info || !info.note) return null;
  const hasDanger = (info.flags || []).includes("contra") || (info.flags || []).includes("nephrotoxic");
  return (
    <div style={{ margin: "8px 0 2px 34px", padding: "10px 13px", background: hasDanger ? "#fff5f5" : "var(--brand-soft)", border: `1px solid ${hasDanger ? "#fca5a5" : "var(--brand)"}30`, borderRadius: 9, fontSize: 12.5, lineHeight: 1.55 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="pill" size={14} color={hasDanger ? "#b91c1c" : "var(--brand-deep)"} />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: hasDanger ? "#b91c1c" : "var(--brand-deep)", marginRight: 8, fontSize: 12 }}>{info.cls}</span>
          <span style={{ color: hasDanger ? "#7f1d1d" : "var(--ink-2)" }}>{info.note}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Med row + autosuggest + dose builder ---------- */
function MedRow({ i, m, setMed, pickDrug, del, canDel }) {
  const [focus, setFocus] = React.useState(false);
  const matches = focus && m.drug.trim().length >= 1
    ? RecentDrugs.sorted(m.drug.trim())
    : (focus ? RecentDrugs.sorted("") : []);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface-2)", position: "relative" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 22 }}>{i + 1}</span>

        <div style={{ flex: "2 1 200px", position: "relative" }}>
          <MiniLabel>ชื่อยา / Drug</MiniLabel>
          <input style={inS} value={m.drug} onChange={(e) => setMed(i, "drug", e.target.value)}
            onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 160)}
            placeholder="พิมพ์ชื่อยา หรือ HN ค้นหา..." />
          {matches.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden" }}>
              {!m.drug.trim() && <div style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, background: "var(--surface-2)" }}>ยาที่ใช้บ่อย</div>}
              {matches.map((d) => (
                <div key={d.name} onMouseDown={() => pickDrug(i, d)} className="acrow"
                  style={{ padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{d.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.cls}</span>
                    </div>
                    {d.note && <div style={{ fontSize: 11, color: d.flags.includes("contra") || d.flags.includes("nephrotoxic") ? "#b91c1c" : "var(--ink-2)", marginTop: 2, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.note}</div>}
                  </div>
                  <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>{(d.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: "0 0 130px" }}>
          <MiniLabel>ความแรง</MiniLabel>
          <StrengthPicker drug={m.drug} value={m.strength} onChange={(v) => setMed(i, "strength", v)} />
        </div>

        <div style={{ flex: "1.8 1 160px" }}>
          <MiniLabel>ขนาด/วิธีใช้</MiniLabel>
          <DoseBuilder value={m.dose} onChange={(v) => setMed(i, "dose", v)} />
        </div>

        <div style={{ flex: "1.4 1 120px" }}>
          <MiniLabel>ผู้ป่วยกินจริง</MiniLabel>
          <input style={inS} value={m.actuallyTaking} onChange={(e) => setMed(i, "actuallyTaking", e.target.value)} placeholder="ตามสั่ง / ระบุ" />
        </div>

        {canDel && <button type="button" onClick={del} title="ลบ" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-2)", padding: 4, marginTop: 20 }}><Icon name="x" size={18} /></button>}
      </div>

      {m.flags && m.flags.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, marginLeft: 34, flexWrap: "wrap" }}>
          {m.flags.map((fl) => <FlagTag key={fl} fl={fl} />)}
        </div>
      )}
      {m.drug && <DrugInfoCard drug={m.drug} />}
    </div>
  );
}

function FlagDot({ fl }) { const m = FLAG_LABEL[fl]; return m ? <span title={m.th} style={{ width: 8, height: 8, borderRadius: 99, background: m.color, display: "inline-block" }} /> : null; }
function FlagTag({ fl }) { const m = FLAG_LABEL[fl]; if (!m) return null; return <span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: m.color + "15", border: `1px solid ${m.color}40`, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="alert" size={11} color={m.color} />{m.th}</span>; }

/* ---------- ส่วนประกอบฟอร์ม ---------- */
function FSection({ n, title, en, badge, badgeTone, defaultOpen, lockOpen, open, onToggle, children }) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const isOpen = open != null ? open : localOpen;
  const tgl = () => { if (lockOpen) return; if (onToggle) onToggle(); else setLocalOpen((o) => !o); };
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", marginBottom: 14, overflow: "hidden" }}>
      <button type="button" onClick={tgl} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: lockOpen ? "default" : "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand-deep)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{n}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
          {en && <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{en}</span>}
        </span>
        {badge && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: badgeTone === "danger" ? "#fef2f2" : "var(--brand-soft)", color: badgeTone === "danger" ? "#b91c1c" : "var(--brand-deep)" }}>{badge}</span>}
        {!lockOpen && <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--ink-2)" }}><Icon name="chevron" size={18} /></span>}
      </button>
      {isOpen && <div style={{ padding: "4px 18px 18px" }}>{children}</div>}
    </div>
  );
}

function Field({ label, en, unit, req, w, grow, style, children }) {
  return (
    <div style={{ width: w, flex: grow ? "1 1 160px" : w ? `0 0 ${w}px` : undefined, ...style }}>
      {label && <MiniLabel>{label}{en && <span style={{ fontWeight: 400, color: "var(--ink-2)" }}> · {en}</span>}{req && <span style={{ color: "#dc2626" }}> *</span>}{unit && <span style={{ fontWeight: 400, color: "var(--ink-2)" }}> ({unit})</span>}</MiniLabel>}
      {children}
    </div>
  );
}
function MiniLabel({ children }) { return <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{children}</label>; }

function ChipGroup({ options, selected, onToggle, danger, small }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = selected.includes(o.key);
        const c = danger && on ? "#dc2626" : "var(--brand)";
        return (
          <button key={o.key} type="button" onClick={() => onToggle(o.key)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: small ? "6px 11px" : "8px 13px", borderRadius: 9, border: `1px solid ${on ? c : "var(--border)"}`, background: on ? (danger ? "#fef2f2" : "var(--brand-soft)") : "var(--surface)", color: on ? c : "var(--ink-2)", fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "var(--sans)" }}>
            <CheckBox on={on} danger={danger} mini />{o.th}
          </button>
        );
      })}
    </div>
  );
}

function CheckBox({ on, onClick, danger, mini }) {
  const c = danger ? "#dc2626" : "var(--brand)";
  return (
    <span onClick={onClick} style={{ width: mini ? 15 : 18, height: mini ? 15 : 18, borderRadius: 5, border: `1.6px solid ${on ? c : "var(--border)"}`, background: on ? c : "transparent", display: "grid", placeItems: "center", flexShrink: 0, cursor: onClick ? "pointer" : "inherit" }}>
      {on && <Icon name="check" size={mini ? 10 : 12} color="#fff" stroke={3} />}
    </span>
  );
}
function Check({ label, on, onClick }) {
  return <label onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink)", cursor: "pointer" }}><CheckBox on={on} />{label}</label>;
}

function segBtn(on, danger) {
  const c = danger ? "#dc2626" : "var(--brand)";
  return { padding: "9px 18px", borderRadius: 9, border: `1px solid ${on ? c : "var(--border)"}`, background: on ? (danger ? "#fef2f2" : "var(--brand-soft)") : "var(--surface)", color: on ? c : "var(--ink-2)", fontSize: 13.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "var(--sans)" };
}

const inS = { width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)", boxSizing: "border-box", outline: "none" };
const fGrid = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "start" };
const ghostBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" };

Object.assign(window, { BpmlForm });
