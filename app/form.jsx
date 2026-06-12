/* =========================================================================
   form.jsx — แบบบันทึก BPML v2
   ใหม่: HN auto-fill, copy last visit, quick dose builder, recent drugs,
         drug-allergy cross-check, CKD-EPI 2021 eGFR, smoother med copy
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

/* =========================================================================
   Feature 1: Drug Allergy Cross-Check
   checkAllergyConflict(drugName, allergyString) → {conflict: bool, reason: string}
   ========================================================================= */
function checkAllergyConflict(drugName, allergyString) {
  if (!drugName || !allergyString) return { conflict: false, reason: "" };

  const dn = drugName.toLowerCase().trim();

  // tokenise allergy string by commas, slashes, spaces
  const tokens = allergyString
    .split(/[,\/\s]+/)
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  if (!tokens.length) return { conflict: false, reason: "" };

  // drug-class rules
  const CLASS_RULES = [
    {
      keys: ["penicillin", "amoxicillin", "ampicillin", "piperacillin", "co-amoxiclav"],
      matchFn: (d) => d.includes("cillin") || d.includes("co-amoxiclav"),
      label: "Penicillin",
    },
    {
      // cephalosporin cross-reactivity — triggered only by penicillin allergy token
      keys: ["penicillin"],
      matchFn: (d) => d.startsWith("cef") || d.startsWith("ceph"),
      label: "Penicillin (cross-reactivity ~10% กับ Cephalosporins)",
    },
    {
      keys: ["sulfa", "sulfonamide", "sulphonamide", "sulfamethoxazole", "tmp-smx", "cotrimoxazole", "bactrim"],
      matchFn: (d) =>
        d.includes("sulfa") || d.includes("sulfame") || d === "tmp-smx" ||
        d === "cotrimoxazole" || d === "furosemide" || d === "hydrochlorothiazide" ||
        d === "hctz" || d === "celecoxib" || d === "glipizide" || d === "gliclazide",
      label: "Sulfonamide",
    },
    {
      keys: ["nsaid", "aspirin", "ibuprofen", "naproxen", "diclofenac", "celecoxib", "mefenamic", "indomethacin"],
      matchFn: (d) =>
        ["aspirin", "ibuprofen", "naproxen", "diclofenac", "celecoxib", "mefenamic acid",
          "mefenamic", "indomethacin", "meloxicam", "piroxicam", "ketorolac", "etoricoxib",
          "nimesulide"].includes(d),
      label: "NSAID/Aspirin",
    },
    {
      keys: ["iodine", "iodide", "contrast", "povidone"],
      matchFn: (d) => d.includes("iodine") || d.includes("povidone"),
      label: "Iodine/Contrast",
    },
    {
      keys: ["acei", "ace", "enalapril", "lisinopril", "ramipril", "captopril", "angioedema"],
      matchFn: (d) => d.endsWith("pril"),
      label: "ACE Inhibitor",
    },
    {
      keys: ["statin", "simvastatin", "atorvastatin", "rosuvastatin", "pravastatin", "lovastatin", "fluvastatin", "pitavastatin"],
      matchFn: (d) => d.endsWith("statin"),
      label: "Statin",
    },
    {
      keys: ["allopurinol"],
      matchFn: (d) => d === "allopurinol",
      label: "Allopurinol (HLA-B*5801 — ความเสี่ยงสูงในผู้ป่วยไทย)",
    },
  ];

  for (const tok of tokens) {
    // 1. class-based matching
    for (const rule of CLASS_RULES) {
      const keyHit = rule.keys.some((k) => tok === k || tok.includes(k) || k.includes(tok));
      if (keyHit && rule.matchFn(dn)) {
        return {
          conflict: true,
          reason: `${drugName} อาจตรงกับ allergy '${allergyString}' (กลุ่ม ${rule.label})`,
        };
      }
    }

    // 2. generic string overlap (token >= 4 chars to avoid false positives)
    if (tok.length >= 4 && (dn.includes(tok) || tok.includes(dn))) {
      return {
        conflict: true,
        reason: `${drugName} อาจตรงกับ allergy '${allergyString}'`,
      };
    }
  }

  return { conflict: false, reason: "" };
}

/* =========================================================================
   Feature 2: CKD-EPI 2021 (race-free) equations
   Reference: Inker et al., NEJM 2021
   ========================================================================= */
function calcCKDEPI2021(scr, age, sex) {
  const s = parseFloat(scr);
  const a = parseFloat(age);
  if (!s || !a || s <= 0 || a <= 0) return null;

  const isFemale = sex === "female";
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = s / kappa;

  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, a) *
    (isFemale ? 1.012 : 1);

  return Math.round(egfr * 10) / 10;
}

function ckdStageFromEgfr(egfr) {
  const v = parseFloat(egfr);
  if (isNaN(v) || v <= 0) return null;
  if (v >= 90) return "G1";
  if (v >= 60) return "G2";
  if (v >= 45) return "G3a";
  if (v >= 30) return "G3b";
  if (v >= 15) return "G4";
  return "G5";
}

// แปลง "G3a" → "3a" ให้ตรงกับ CKD_STAGES ที่ฟอร์มเก็บ
function normStage(s) { return s ? String(s).replace(/^G/i, "").trim() : ""; }

/* ---------- FloatInput ---------- */
function FloatInput({ label, value, onChange, type, unit, style: extraStyle, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const hasVal = value !== '' && value !== null && value !== undefined;
  const lifted = focused || hasVal;
  return (
    <div style={{ position: 'relative', paddingTop: 18, ...extraStyle }}>
      <label style={{
        position: 'absolute', left: 12,
        top: lifted ? 2 : 26,
        fontSize: lifted ? 10 : 13.5,
        fontWeight: lifted ? 700 : 400,
        color: focused ? 'var(--brand)' : lifted ? 'var(--ink-2)' : '#9aa8a6',
        transition: 'all 0.16s ease',
        pointerEvents: 'none', zIndex: 1,
        background: lifted ? 'var(--surface)' : 'transparent',
        padding: lifted ? '0 3px' : '0',
        lineHeight: 1,
      }}>
        {label}{unit && <span style={{ fontFamily: 'var(--mono)', opacity: 0.7, marginLeft: 3 }}>{unit}</span>}
      </label>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 12px 8px',
          border: `1.5px solid ${focused ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: 10, fontSize: 14,
          background: 'var(--surface)', color: 'var(--ink)',
          outline: 'none', fontFamily: 'var(--sans)',
          boxShadow: focused ? '0 0 0 3px color-mix(in srgb,var(--brand) 12%,transparent)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
        {...rest}
      />
    </div>
  );
}

/* ---------- StepInput ---------- */
function StepInput({ label, value, onChange, step, min, max, unit, warn, danger }) {
  const num = parseFloat(value) || 0;
  const color = danger ? '#dc2626' : warn ? '#d97706' : 'var(--ink)';
  function adjust(delta) {
    const next = Math.max(min ?? 0, Math.min(max ?? 9999, parseFloat((num + delta).toFixed(2))));
    onChange(String(next));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label !== '' && label !== undefined && label !== null ? <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}{unit && <span style={{ fontFamily: 'var(--mono)', marginLeft: 3 }}>{unit}</span>}</span> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => adjust(-step)}
          style={{ width: 28, height: 36, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-2)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 700 }}>−</button>
        <input
          value={value} onChange={e => onChange(e.target.value)}
          inputMode="decimal" style={{
            flex: 1, textAlign: 'center', padding: '7px 4px',
            border: `1.5px solid ${(danger||warn) ? color : 'var(--border)'}`,
            borderRadius: 8, fontSize: 15, fontWeight: 700,
            color, fontFamily: 'var(--mono)', background: 'var(--surface)',
            outline: 'none', minWidth: 0,
          }} />
        <button type="button" onClick={() => adjust(+step)}
          style={{ width: 28, height: 36, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-2)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
}

/* ---------- FormProgress ---------- */
const FORM_STEPS = [
  { n: '1', label: 'ข้อมูลผู้ป่วย' },
  { n: '2', label: 'รายการยา' },
  { n: '3', label: 'OTC/สมุนไพร' },
  { n: '4', label: 'DRP' },
  { n: '5', label: 'แทรกแซง' },
  { n: '6', label: 'ผลลัพธ์' },
];

function FormProgress({ active, onStepClick }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'var(--surface)', borderRadius: 14,
      padding: '12px 18px', marginBottom: 20,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 12px rgba(0,0,0,.07)',
      overflowX: 'auto', position: 'sticky', top: 0, zIndex: 20,
      backdropFilter: 'blur(12px)',
    }}>
      {FORM_STEPS.map((s, i) => {
        const done = parseInt(active) > parseInt(s.n);
        const cur  = active === s.n;
        return (
          <React.Fragment key={s.n}>
            <div onClick={() => onStepClick && onStepClick(s.n)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                flexShrink:0, cursor: onStepClick ? 'pointer' : 'default' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done
                  ? 'linear-gradient(135deg,var(--brand),var(--brand-deep))'
                  : cur
                    ? 'linear-gradient(135deg,var(--brand),var(--brand-deep))'
                    : 'var(--surface-2)',
                border: `2px solid ${cur||done ? 'var(--brand)' : 'var(--border)'}`,
                display: 'grid', placeItems: 'center',
                color: cur||done ? '#fff' : 'var(--ink-2)',
                fontSize: 11, fontWeight: 800,
                transition: 'all 0.3s cubic-bezier(0.34,1.2,0.64,1)',
                transform: cur ? 'scale(1.15)' : 'scale(1)',
                boxShadow: cur ? '0 0 0 4px rgba(13,148,136,0.2), 0 2px 8px rgba(13,148,136,0.35)' : done ? '0 2px 6px rgba(13,148,136,0.3)' : 'none',
              }}>
                {done ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: cur ? 800 : 500,
                color: cur ? 'var(--brand-deep)' : done ? 'var(--brand)' : 'var(--ink-2)',
                whiteSpace: 'nowrap',
                transition: 'color 0.25s, font-weight 0.2s',
              }}>{s.label}</span>
            </div>
            {i < FORM_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 3, minWidth: 20,
                background: done
                  ? 'linear-gradient(90deg,var(--brand),var(--brand-deep))'
                  : 'var(--border)',
                margin: '0 6px', marginBottom: 18, borderRadius: 99,
                transition: 'background 0.4s ease',
                boxShadow: done ? '0 1px 4px rgba(13,148,136,0.4)' : 'none',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

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

/* ---------- DoseBuilder ---------- */
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
function blankMed() { return { drug: "", strength: "", dose: "", qtyPerDose: "", freqPerDay: "", timing: "", sameAsPrescribed: true, actualQty: "", actualFreq: "", actuallyTaking: "", source: "", remark: "", flags: [] }; }

/* รายชื่อยาที่พบบ่อยตามระยะ CKD (ใช้เป็นตัวช่วยเพิ่มยาเร็ว — ไม่ใช่การสั่งจ่ายอัตโนมัติ)
   เภสัชกรกดเลือกเองและแก้ไขขนาดได้ทั้งหมด อ้างอิงแนวเวชปฏิบัติ KDIGO + คลินิกไตไทย */
const STAGE_MED_TEMPLATES = {
  "3a": ["Losartan", "Dapagliflozin", "Atorvastatin", "Furosemide"],
  "3b": ["Losartan", "Dapagliflozin", "Atorvastatin", "Furosemide", "Sodium bicarbonate", "Ferrous fumarate"],
  "4":  ["Losartan", "Dapagliflozin", "Atorvastatin", "Furosemide", "Sodium bicarbonate", "Calcium carbonate", "Ferrous fumarate", "Folic acid", "Alfacalcidol"],
  "5":  ["Furosemide", "Sodium bicarbonate", "Calcium carbonate", "Sevelamer carbonate", "Calcitriol", "Ferrous fumarate", "Folic acid", "Epoetin alfa (rHuEPO)"],
};

function BpmlForm({ initial, user, records = [], onSave, onCancel }) {
  const DRAFT_KEY = "pharm_ckd_form_draft_v1";

  const [f, setF] = React.useState(() => {
    const blank = {
      hn: "", name: "", age: "", sex: "male", ckdStage: "", date: new Date().toISOString().slice(0,10), scr: "", egfr: "", k: "", na: "",
      hb: "", hco3: "", phos: "", ca: "", uacr: "", dm: false,
      bpSys: "", bpDia: "", hr: "", allergy: "", sources: [], sourceOther: "",
      meds: [], otcItems: [], otcHerbal: false, otcDetail: "", drps: [], drpFindings: [], drpDetail: "", drpAcks: {}, drpManualKeys: [], drpRemovedKeys: [], drpFollowup: {},
      comparedPrev: false, comparedNew: false, discrepancy: "none", discrepancyType: "",
      interventions: [], counselingNote: "", outcome: "", outcomeReason: "", physician: "",
      pharmacist: user.name, pharmacistId: user.id, time: "", followUp: null,
    };
    // edit visit เดิม → ใช้ initial ทั้งหมด
    if (initial?.id) return JSON.parse(JSON.stringify(initial));
    // visit ใหม่ที่ยกข้อมูลผู้ป่วย/ยาเดิมมาให้ (กดจาก "บันทึกครั้งใหม่") → ใช้ seed ทับ blank
    if (initial && (initial.hn || initial._carriedFromVisit)) {
      return { ...blank, ...JSON.parse(JSON.stringify(initial)), pharmacist: user.name, pharmacistId: user.id };
    }
    // new เปล่า → กู้ draft ที่ค้างไว้ถ้ามี
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (draft && draft._savedAt) return draft;
    } catch(e) {}
    return blank;
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k, val) => setF((p) => ({ ...p, [k]: (p[k] || []).includes(val) ? p[k].filter((x) => x !== val) : [...(p[k] || []), val] }));

  // Autosave draft — เฉพาะฟอร์มเปล่า (ไม่ใช่ edit และไม่ใช่ carry-over จาก visit ก่อน)
  const isCarriedSeed = !!(initial && !initial.id && (initial.hn || initial._carriedFromVisit));
  const [draftSavedAt, setDraftSavedAt] = React.useState(null);
  React.useEffect(() => {
    if (initial?.id || isCarriedSeed) return; // ไม่ autosave ตอน edit หรือ carry-over
    const timer = setTimeout(() => {
      const ts = Date.now();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...f, _savedAt: ts }));
      setDraftSavedAt(ts);
    }, 800);
    return () => clearTimeout(timer);
  }, [f]);
  function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  // Duplicate visit detection
  const [dupWarning, setDupWarning] = React.useState(null);
  React.useEffect(() => {
    if (!f.hn.trim() || !f.date) { setDupWarning(null); return; }
    const dup = records.find((r) => r.hn === f.hn.trim() && r.date === f.date && r.id !== initial?.id);
    setDupWarning(dup || null);
  }, [f.hn, f.date]);

  const [openRecon, setOpenRecon] = React.useState(!!(initial?.discrepancy === "found"));
  const [openFollow, setOpenFollow] = React.useState(!!(initial?.followUp));
  const [hnSuggest, setHnSuggest] = React.useState(null);

  // Feature 2: track whether eGFR was manually overridden
  // carry-over seed อาจมี egfr แต่ไม่มี scr → ตั้ง manual=true เพื่อไม่ให้ override ค่า egfr เดิม
  const [egfrManual, setEgfrManual] = React.useState(() => {
    if (initial && !initial.id && initial.egfr && !initial.scr) return true;
    return false;
  });
  const [egfrAutoVal, setEgfrAutoVal] = React.useState(null);

  // Feature 2: auto-compute eGFR with CKD-EPI 2021 whenever scr/age/sex change
  React.useEffect(() => {
    if (egfrManual) return;
    const computed = calcCKDEPI2021(f.scr, f.age, f.sex);
    if (computed !== null) {
      setEgfrAutoVal(computed);
      setF((p) => ({ ...p, egfr: String(computed) }));
    }
  }, [f.scr, f.age, f.sex, egfrManual]);

  // TASK 3: auto-fill CKD stage from eGFR when stage is empty
  React.useEffect(() => {
    if (f.ckdStage) return;
    const st = ckdStageFromEgfr(f.egfr);
    if (st) setF((p) => (p.ckdStage ? p : { ...p, ckdStage: normStage(st) }));
  }, [f.egfr, f.ckdStage]);

  // TASK 3: detect contradiction between entered stage and eGFR-calculated stage
  const egfrStage = React.useMemo(() => normStage(ckdStageFromEgfr(f.egfr)), [f.egfr]);
  const stageContradiction = !!(f.ckdStage && egfrStage && f.ckdStage !== egfrStage);

  // C1: auto-recalculate age when visit date changes (if DOB is stored)
  React.useEffect(() => {
    if (!f.dob) return;
    const age = Math.floor((new Date(f.date || new Date()) - new Date(f.dob)) / 31557600000);
    if (age >= 0 && age <= 130) setF((p) => ({ ...p, age: String(age) }));
  }, [f.date, f.dob]);

  // Feature 3 + 5: copy from last visit modal state
  const [copyModalVisit, setCopyModalVisit] = React.useState(null);
  const [copySelection, setCopySelection] = React.useState({});
  const [copyLab, setCopyLab] = React.useState(true);
  const [copyAllergy, setCopyAllergy] = React.useState(true);

  // HN lookup
  function onHnChange(hn) {
    set("hn", hn);
    if (hn.trim().length >= 4) {
      const prev = records.filter((r) => r.hn === hn.trim() && r.id !== initial?.id)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setHnSuggest(prev[0] || null);
    } else { setHnSuggest(null); }
  }

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

  // Feature 3 + 5: open copy modal (enhanced)
  function openCopyModal(visit) {
    const meds = visit.meds || [];
    const sel = {};
    meds.forEach((_, idx) => { sel[idx] = true; });
    setCopyModalVisit(visit);
    setCopySelection(sel);
    setCopyLab(true);
    setCopyAllergy(true);
  }

  function applyCopySelection() {
    if (!copyModalVisit) return;
    const meds = (copyModalVisit.meds || []).filter((_, idx) => copySelection[idx]);
    setF((p) => {
      const next = { ...p };
      if (meds.length) next.meds = meds.map((m) => ({ ...m }));
      if (copyLab) {
        // Feature 5: copy lab values
        if (copyModalVisit.egfr) next.egfr = copyModalVisit.egfr;
        if (copyModalVisit.scr)  next.scr  = copyModalVisit.scr;
        if (copyModalVisit.k)    next.k    = copyModalVisit.k;
        if (copyModalVisit.hb)   next.hb   = copyModalVisit.hb;
        if (copyModalVisit.hco3) next.hco3 = copyModalVisit.hco3;
      }
      if (copyAllergy && copyModalVisit.allergy) next.allergy = copyModalVisit.allergy;
      // Feature 5: copy OTC items
      if (copyModalVisit.otcItems && copyModalVisit.otcItems.length) {
        next.otcItems = (copyModalVisit.otcItems || []).map(o => ({ ...o }));
      }
      return next;
    });
    setCopyModalVisit(null);
  }

  // TASK 5: one-tap copy of meds + labs + allergy + otcItems from a visit
  function oneTapCopyVisit(v) {
    if (!v) return;
    setF((p) => ({
      ...p,
      meds: (v.meds || []).map((m) => ({ ...m })),
      otcItems: (v.otcItems || []).map((o) => ({ ...o })),
      allergy: v.allergy || p.allergy,
      egfr: v.egfr || p.egfr,
      scr: v.scr || p.scr,
      k: v.k || p.k,
      na: v.na || p.na,
      hb: v.hb || p.hb,
      hco3: v.hco3 || p.hco3,
      phos: v.phos || p.phos,
      ca: v.ca || p.ca,
      uacr: v.uacr || p.uacr,
      bpSys: v.bpSys || p.bpSys,
      bpDia: v.bpDia || p.bpDia,
    }));
    if (v.egfr) setEgfrManual(true);
    // scroll focus to labs section so values can be updated quickly
    setTimeout(() => {
      const el = sectionRefs.current["1"];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const [showVisitPicker, setShowVisitPicker] = React.useState(false);
  const prevVisits = React.useMemo(() => records
    .filter((r) => r.hn === f.hn.trim() && r.id !== initial?.id && (r.meds?.length > 0 || r.ckdStage))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")), [records, f.hn, initial]);

  function copyFromVisit(r) { openCopyModal(r); setShowVisitPicker(false); }
  function fillPatientFromVisit(r) {
    setF((p) => ({ ...p, name: r.name || p.name, age: r.age || p.age, ckdStage: r.ckdStage || p.ckdStage, allergy: r.allergy || p.allergy, physician: r.physician || p.physician }));
  }

  const risk = computeRisk(f);

  // FormProgress active step — scroll-based detection
  const [activeStep, setActiveStep] = React.useState('1');
  const sectionRefs = React.useRef({});
  React.useEffect(() => {
    function onScroll() {
      const order = ['1','2','3','4','5','6'];
      let current = '1';
      for (const n of order) {
        const el = sectionRefs.current[n];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.45) current = n;
        }
      }
      setActiveStep(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const setMed = (i, k, v) => setF((p) => { const m = [...p.meds]; m[i] = { ...m[i], [k]: v }; return { ...p, meds: m }; });
  const setMedFields = (i, obj) => setF((p) => { const m = [...p.meds]; m[i] = { ...m[i], ...obj }; return { ...p, meds: m }; });
  const addMed = () => setF((p) => ({ ...p, meds: [...p.meds, blankMed()] }));
  const addDrugFromSearch = (d) => {
    RecentDrugs.record(d.name);
    setF((p) => ({ ...p, meds: [...p.meds, { ...blankMed(), drug: d.name, strength: (d.strengths && d.strengths[0]) || "", flags: d.flags || [] }] }));
  };
  const delMed = (i) => setF((p) => ({ ...p, meds: p.meds.filter((_, j) => j !== i) }));

  // Visit template: เพิ่มยาตามชื่อจากเทมเพลต (ถ้ายังไม่มีในรายการ) — เภสัชกรแก้ไขขนาดเองภายหลัง
  const quickAddByName = (name) => {
    const info = (typeof lookupDrug === "function") ? lookupDrug(name) : null;
    setF((p) => {
      if (p.meds.some((m) => m.drug && m.drug.trim().toLowerCase() === name.toLowerCase())) return p;
      RecentDrugs.record(name);
      return { ...p, meds: [...p.meds, { ...blankMed(), drug: name, strength: (info && info.strengths && info.strengths[0]) || "", flags: (info && info.flags) || [] }] };
    });
  };
  const stageKey = (f.ckdStage || "").toLowerCase().replace(/[^0-9ab]/g, "");
  const templateDrugs = STAGE_MED_TEMPLATES[stageKey] || [];

  // Feature 1: allergy conflicts per med row
  const allergyConflicts = React.useMemo(() =>
    f.meds.map((m) => m.drug ? checkAllergyConflict(m.drug, f.allergy) : { conflict: false, reason: "" }),
    [f.meds, f.allergy]
  );
  const hasAnyConflict = allergyConflicts.some((c) => c.conflict);

  // Feature 2: suggested CKD stage from computed eGFR
  const suggestedStage = React.useMemo(() => {
    if (!egfrManual && egfrAutoVal !== null) return ckdStageFromEgfr(egfrAutoVal);
    return ckdStageFromEgfr(f.egfr);
  }, [egfrAutoVal, egfrManual, f.egfr]);

  // ===== TASK 1: DRP single source of truth =====
  // analyzeDRPs() is the single analyzer. Findings drive the saved drps[].
  // Final drps[] = (auto keys ∪ manual-added) − manual-removed.
  const drpFindings = React.useMemo(() => {
    try {
      if (typeof window.analyzeDRPs !== "function") return [];
      // visit ก่อนหน้าที่มี eGFR (สำหรับตรวจ eGFR ลดเร็ว)
      const prevWithEgfr = prevVisits.find((r) => r.egfr && parseFloat(r.egfr) > 0);
      let prevEgfr = null, prevEgfrDays = null;
      if (prevWithEgfr && f.date && prevWithEgfr.date) {
        prevEgfr = parseFloat(prevWithEgfr.egfr);
        const d1 = new Date(prevWithEgfr.date), d2 = new Date(f.date);
        if (!isNaN(d1) && !isNaN(d2)) prevEgfrDays = Math.round((d2 - d1) / 86400000);
      }
      const res = window.analyzeDRPs({
        meds: f.meds, otcItems: f.otcItems || [], egfr: f.egfr, k: f.k, ckdStage: f.ckdStage,
        hb: f.hb, hco3: f.hco3, phos: f.phos, ca: f.ca, bpSys: f.bpSys, bpDia: f.bpDia,
        uacr: f.uacr, dm: f.dm, age: f.age, followUp: f.followUp, allergy: f.allergy,
        prevEgfr, prevEgfrDays,
      });
      return (res && Array.isArray(res.findings)) ? res.findings : [];
    } catch (e) { return []; }
  }, [f.meds, f.otcItems, f.egfr, f.k, f.ckdStage, f.hb, f.hco3, f.phos, f.ca, f.bpSys, f.bpDia, f.uacr, f.dm, f.age, f.followUp, f.allergy, f.date, prevVisits]);

  const autoDrpKeys = React.useMemo(() =>
    (typeof window.summarizeDrpKeys === "function") ? window.summarizeDrpKeys(drpFindings) : [],
    [drpFindings]);

  // Derived final key list = auto ∪ manual − removed
  const finalDrpKeys = React.useMemo(() => {
    const removed = new Set(f.drpRemovedKeys || []);
    const set = new Set();
    autoDrpKeys.forEach((k) => { if (!removed.has(k)) set.add(k); });
    (f.drpManualKeys || []).forEach((k) => { if (!removed.has(k)) set.add(k); });
    return [...set];
  }, [autoDrpKeys, f.drpManualKeys, f.drpRemovedKeys]);

  // Toggle a key in the manual chip selector (override on top of auto-analysis)
  function toggleDrpKey(key) {
    setF((p) => {
      const auto = new Set(autoDrpKeys);
      const manual = new Set(p.drpManualKeys || []);
      const removed = new Set(p.drpRemovedKeys || []);
      const currentlyOn = (auto.has(key) && !removed.has(key)) || manual.has(key);
      if (currentlyOn) {
        // turn OFF: drop manual, and if it was an auto key mark removed
        manual.delete(key);
        if (auto.has(key)) removed.add(key);
      } else {
        // turn ON: clear removed; if not auto, add manual
        removed.delete(key);
        if (!auto.has(key)) manual.add(key);
      }
      return { ...p, drpManualKeys: [...manual], drpRemovedKeys: [...removed] };
    });
  }

  // Keep saved drps[] mirrored to derived final list (so risk engine / store stay consistent)
  React.useEffect(() => {
    setF((p) => {
      const cur = p.drps || [];
      const same = cur.length === finalDrpKeys.length && cur.every((k) => finalDrpKeys.includes(k));
      return same ? p : { ...p, drps: finalDrpKeys };
    });
  }, [finalDrpKeys]);

  const fidOf = (fd, i) => fd.id || ("f_" + i + "_" + (fd.msg || "").slice(0, 24));
  const unackedHighFindings = React.useMemo(() =>
    drpFindings.filter((fd, i) => fd.sev === "HIGH" && !(f.drpAcks || {})[fidOf(fd, i)]),
    [drpFindings, f.drpAcks]);

  function handleDrpFindings() { /* findings are computed in parent; panel only renders */ }

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  function save() {
    if (saving) return; // A5: กันกดบันทึกซ้ำ (Enter + click พร้อมกัน) ที่ทำให้เกิด record ซ้ำ
    // B1: mark attempted save so required fields show red
    if (!valid) {
      setTriedSave(true);
      scrollToStep("1");
      return;
    }
    // TASK 1: block save if HIGH findings are not acknowledged
    if (unackedHighFindings.length > 0) {
      setActiveStep("4");
      const el = sectionRefs.current["4"];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      alert(`พบปัญหาด้านยาความเสี่ยงสูง ${unackedHighFindings.length} รายการที่ยังไม่ได้รับทราบ\nกรุณากด "รับทราบ" ในแผงผลวิเคราะห์ DRP ก่อนบันทึก`);
      return;
    }
    // เตือนค่า lab ผิดปกติก่อนบันทึก (ยืนยันได้ถ้าตั้งใจ)
    if (labWarnings.length > 0) {
      const ok = window.confirm(`พบค่าที่อาจผิดปกติ ${labWarnings.length} รายการ:\n\n• ${labWarnings.join("\n• ")}\n\nต้องการบันทึกต่อหรือไม่?`);
      if (!ok) return;
    }
    setSaving(true);
    const rec = {
      ...f,
      riskScore: risk.score, riskBand: risk.band,
      drps: finalDrpKeys,        // final key list (auto ∪ manual − removed)
      drpFindings: drpFindings,  // full audit trail of the analysis
    };
    if (!rec.createdBy) rec.createdBy = user.id;
    delete rec._carriedFromVisit;
    rec.meds = rec.meds.filter((m) => (m.drug || "").trim());
    rec.meds.forEach((m) => RecentDrugs.record(m.drug));
    clearDraft();
    setSaved(true);
    setTimeout(() => { setSaving(false); onSave(rec); }, 400);
  }

  function scrollToStep(n) {
    const el = sectionRefs.current[n];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const valid = f.hn.trim() && f.name.trim() && f.ckdStage;

  // B1: track whether user tried to save (to show required-field errors)
  const [triedSave, setTriedSave] = React.useState(false);
  const missingHn   = triedSave && !f.hn.trim();
  const missingName = triedSave && !f.name.trim();
  const missingStage = triedSave && !f.ckdStage;

  // ── ตรวจค่า lab/สัญญาณชีพ ที่อยู่นอกช่วงสมเหตุผล (เตือน ไม่บล็อก) ──
  const labWarnings = React.useMemo(() => {
    const out = [];
    const chk = (key, label, min, max, unit) => {
      const raw = f[key];
      if (raw === "" || raw == null) return;
      const v = parseFloat(raw);
      if (isNaN(v)) { out.push(`${label}: "${raw}" ไม่ใช่ตัวเลข`); return; }
      if (v < min || v > max) out.push(`${label} ${v}${unit ? " " + unit : ""} อยู่นอกช่วงปกติ (${min}–${max})`);
    };
    chk("age", "อายุ", 0, 120, "ปี");
    chk("scr", "Scr", 0.1, 20, "mg/dL");
    chk("egfr", "eGFR", 1, 150, "mL/min");
    chk("k", "K⁺", 1.5, 8.5, "mmol/L");
    chk("na", "Na⁺", 100, 175, "mmol/L");
    chk("hb", "Hb", 3, 22, "g/dL");
    chk("hco3", "HCO₃", 5, 45, "mmol/L");
    chk("phos", "Phosphate", 0.5, 15, "mg/dL");
    chk("ca", "Calcium", 4, 16, "mg/dL");
    chk("bpSys", "BP systolic", 60, 270, "mmHg");
    chk("bpDia", "BP diastolic", 30, 170, "mmHg");
    chk("hr", "HR", 25, 230, "/min");
    // ความสอดคล้อง: systolic ควรมากกว่า diastolic
    const s = parseFloat(f.bpSys), d = parseFloat(f.bpDia);
    if (!isNaN(s) && !isNaN(d) && s <= d) out.push(`BP: systolic (${s}) ควรมากกว่า diastolic (${d})`);
    return out;
  }, [f.age, f.scr, f.egfr, f.k, f.na, f.hb, f.hco3, f.phos, f.ca, f.bpSys, f.bpDia, f.hr]);

  // มีการแก้ไขที่ยังไม่บันทึก — carry-over seed ถือว่า dirty ทันที
  const [dirty, setDirty] = React.useState(() => isCarriedSeed);
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!saved) setDirty(true);
  }, [f]);

  // เตือนก่อนปิด/รีเฟรชแท็บถ้ายังมีข้อมูลที่ยังไม่บันทึก
  React.useEffect(() => {
    function onBeforeUnload(e) {
      if (dirty && !saved) { e.preventDefault(); e.returnValue = ""; return ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saved]);

  // Ctrl/Cmd+S → บันทึก (ถ้าข้อมูลครบ)
  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (valid && !saving) save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [valid, saving, unackedHighFindings.length]);

  // ยกเลิกแบบมี guard: ถ้ามีข้อมูลที่ยังไม่บันทึกให้ยืนยันก่อน
  function handleCancel() {
    if (dirty && !saved && !window.confirm("ยังมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) return;
    onCancel && onCancel();
  }

  return (
    <div style={{ paddingBottom: 96 }}>

      {/* Feature 3: Copy Meds Modal */}
      {copyModalVisit && (
        <div className="modal-overlay"
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setCopyModalVisit(null); }}
        >
          <div className="modal-card" style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", width: "min(560px, 96vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>พบข้อมูลล่าสุด {fmtDate(copyModalVisit.date)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{(copyModalVisit.meds || []).length} รายการยา · เลือกสิ่งที่ต้องการคัดลอก</div>
              </div>
              <button type="button" onClick={() => setCopyModalVisit(null)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Icon name="x" size={18} color="var(--ink-2)" /></button>
            </div>
            {/* Feature 5: Copy options */}
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
                <CheckBox on={copyLab} onClick={() => setCopyLab(o => !o)} />
                Lab (eGFR, Cr, K, Hb, HCO₃)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
                <CheckBox on={copyAllergy} onClick={() => setCopyAllergy(o => !o)} />
                การแพ้ยา (Allergy)
              </label>
              {(copyModalVisit.otcItems || []).length > 0 && (
                <span style={{ fontSize: 12, color: "var(--ink-2)", alignSelf: "center" }}>+ OTC/สมุนไพร {(copyModalVisit.otcItems || []).length} รายการ (คัดลอกอัตโนมัติ)</span>
              )}
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px" }}>
              {/* select-all row */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 10px", borderBottom: "1px solid var(--border)", marginBottom: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                <CheckBox
                  on={Object.values(copySelection).length > 0 && Object.values(copySelection).every(Boolean)}
                  onClick={() => {
                    const allOn = Object.values(copySelection).every(Boolean);
                    const next = {};
                    (copyModalVisit.meds || []).forEach((_, idx) => { next[idx] = !allOn; });
                    setCopySelection(next);
                  }}
                />
                เลือกทั้งหมด
              </label>
              {(copyModalVisit.meds || []).map((m, idx) => {
                const ac = checkAllergyConflict(m.drug, f.allergy);
                return (
                  <label key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px", borderRadius: 9, marginBottom: 6, cursor: "pointer", background: ac.conflict ? "#fff5f5" : "var(--surface-2)", border: `1px solid ${ac.conflict ? "#fca5a5" : "var(--border)"}` }}>
                    <CheckBox on={!!copySelection[idx]} onClick={() => setCopySelection((p) => ({ ...p, [idx]: !p[idx] }))} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{m.drug || "–"}</span>
                        {m.strength && <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{m.strength}</span>}
                        {m.dose && <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{m.dose}</span>}
                        {(m.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}
                      </div>
                      {ac.conflict && (
                        <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 4, fontWeight: 600 }}>⚠️ {ac.reason}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setCopyModalVisit(null)} style={ghostBtn}>ยกเลิก</button>
              <button type="button" onClick={applyCopySelection}
                style={{ ...ghostBtn, background: "var(--brand)", color: "#fff", border: "none", fontWeight: 700 }}>
                📋 คัดลอกที่เลือก ({Object.values(copySelection).filter(Boolean).length})
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1080, margin: "0 auto" }}>
        <PageHead
          title={initial ? "แก้ไขแบบบันทึก BPML" : "แบบบันทึก BPML ใหม่"}
          sub="Best Possible Medication List & Medication Reconciliation"
          action={<button onClick={handleCancel} style={ghostBtn}><Icon name="x" size={16} />ยกเลิก</button>}
        />

        {/* C3: Draft autosave indicator with timestamp */}
        {!initial?.id && !isCarriedSeed && draftSavedAt && (
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#16a34a", marginBottom:8, animation:"fadeIn 0.2s ease-out both" }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
            บันทึก draft อัตโนมัติ เวลา {new Date(draftSavedAt).toLocaleTimeString("th-TH", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </div>
        )}

        {/* Duplicate visit warning */}
        {dupWarning && (
          <div style={{ marginBottom:14, padding:"12px 16px", background:"#fffbeb", border:"1.5px solid #fbbf24", borderRadius:12, display:"flex", alignItems:"flex-start", gap:10, animation:"fadeUp 0.25s ease-out both" }}>
            <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13.5, color:"#92400e" }}>พบ Visit ของผู้ป่วยนี้ในวันเดียวกันแล้ว</div>
              <div style={{ fontSize:12.5, color:"#78350f", marginTop:2 }}>
                {dupWarning.name} · HN {dupWarning.hn} · วันที่ {fmtDate(dupWarning.date)} · บันทึกโดย {dupWarning.pharmacist || "–"}
              </div>
            </div>
          </div>
        )}

        <FormProgress active={activeStep} onStepClick={scrollToStep} />

        {/* TASK 4: Previous-visit / Trend panel (appears when HN has prior visits) */}
        {prevVisits.length > 0 && typeof window.PrevVisitPanel === "function" && (
          <PrevVisitPanel
            priorVisits={prevVisits}
            current={f}
            onOneTapCopy={oneTapCopyVisit}
          />
        )}

        {/* ส่วนที่ 1 */}
        <div ref={el => sectionRefs.current['1'] = el}>
        <FSection n="1" title="ข้อมูลผู้ป่วย" en="Patient Information" defaultOpen lockOpen>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,160px) 1fr 90px", gap: 12, alignItems: "start" }} className="pinfo-row">
            <div>
              <FloatInput label="HN *" value={f.hn} onChange={(e) => { onHnChange(e.target.value); setTriedSave(false); }} placeholder="66xxxxx"
                style={{ outline: missingHn ? "2px solid #dc2626" : undefined, borderRadius: 10 }} />
              {missingHn && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3, fontWeight: 600 }}>⚠ กรุณากรอก HN</div>}
            </div>
            <div>
              <FloatInput label="ชื่อ-สกุล *" value={f.name} onChange={(e) => { set("name", e.target.value); setTriedSave(false); }}
                style={{ outline: missingName ? "2px solid #dc2626" : undefined, borderRadius: 10 }} />
              {missingName && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3, fontWeight: 600 }}>⚠ กรุณากรอกชื่อ-สกุล</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FloatInput label="อายุ" unit="ปี" value={f.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" />
              {/* C1: DOB → auto age */}
              {f.dob ? (
                <div style={{ fontSize: 10.5, color: "var(--brand-deep)", fontWeight: 600, paddingLeft: 2 }}>
                  เกิด {f.dob}
                  <button type="button" onClick={() => set("dob", "")} style={{ marginLeft: 6, border: "none", background: "none", color: "var(--ink-2)", cursor: "pointer", fontSize: 11, padding: 0 }}>✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => { const d = prompt("วันเกิด (YYYY-MM-DD):"); if (!d) return; const age = Math.floor((new Date(f.date || new Date()) - new Date(d)) / 31557600000); if (age >= 0 && age <= 130) { set("dob", d); set("age", String(age)); } }}
                  style={{ fontSize: 10.5, color: "var(--ink-2)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "2px 7px", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
                  + ใส่วันเกิด
                </button>
              )}
            </div>
          </div>

          {/* HN suggest banner */}
          {hnSuggest && (
            <div style={{ marginTop: 10, padding: "11px 14px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Icon name="user" size={18} color="var(--brand-deep)" />
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>
                พบผู้ป่วย: <strong>{hnSuggest.name}</strong> · CKD {hnSuggest.ckdStage} · visit ล่าสุด {fmtDate(hnSuggest.date)}
              </span>
              {/* Feature 3: prominent copy button directly in banner */}
              {(hnSuggest.meds || []).length > 0 && (
                <button type="button" onClick={() => openCopyModal(hnSuggest)}
                  style={{ ...ghostBtn, background: "#fff7ed", color: "#92400e", borderColor: "#f59e0b", fontWeight: 700, fontSize: 13 }}>
                  📋 คัดลอกยาครั้งก่อน
                </button>
              )}
              <button type="button" onClick={fillFromPrev} style={{ ...ghostBtn, background: "var(--brand)", color: "#fff", border: "none", fontSize: 13 }}>
                <Icon name="check" size={14} color="#fff" />เติมข้อมูล
              </button>
              <button type="button" onClick={() => setHnSuggest(null)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={16} color="var(--ink-2)" /></button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Field label="CKD stage" req>
              {missingStage && <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 6, fontWeight: 600 }}>⚠ กรุณาเลือก CKD Stage</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", outline: missingStage ? "2px solid #dc2626" : undefined, borderRadius: 10, padding: missingStage ? 4 : 0 }}>
                {CKD_STAGES.map((s) => (
                  <button key={s} type="button" onClick={() => { set("ckdStage", s); setTriedSave(false); }}
                    style={{ flex: "1 1 60px", maxWidth: 110, padding: "10px 0", border: `1px solid ${f.ckdStage === s ? "var(--brand)" : "var(--border)"}`, background: f.ckdStage === s ? "var(--brand)" : "var(--surface)", color: f.ckdStage === s ? "#fff" : "var(--ink-2)", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" }}>{s}</button>
                ))}
              </div>
              {stageContradiction && (
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 11px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 99, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                  ⚠️ eGFR แนะนำ G{egfrStage} — ขัดกับที่เลือก (G{f.ckdStage})
                  <button type="button" onClick={() => set("ckdStage", egfrStage)}
                    style={{ border: "1px solid #d97706", background: "#fff", color: "#92400e", borderRadius: 7, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", cursor: "pointer" }}>
                    ใช้ค่าที่คำนวณ
                  </button>
                </div>
              )}
            </Field>
          </div>
          <div style={{ ...fGrid, marginTop: 12 }}>
            <FloatInput label="วันที่" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} style={{ flex: '0 0 150px' }} />

            {/* Sex selector */}
            <div style={{ flex: "0 0 auto" }}>
              <MiniLabel>เพศ · Sex</MiniLabel>
              <div style={{ display: "flex", gap: 4 }}>
                {[["male", "ชาย"], ["female", "หญิง"]].map(([v, t]) => (
                  <button key={v} type="button"
                    onClick={() => { set("sex", v); setEgfrManual(false); }}
                    style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${f.sex === v ? "var(--brand)" : "var(--border)"}`, background: f.sex === v ? "var(--brand)" : "var(--surface)", color: f.sex === v ? "#fff" : "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Scr StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="Scr" unit="mg/dL" value={f.scr} onChange={(v) => { set("scr", v); setEgfrManual(false); }} step={0.1} min={0.1} max={20} />
            </div>

            {/* eGFR StepInput with CKD-EPI badge */}
            <div style={{ flex: "0 0 180px" }}>
              <StepInput label="eGFR" unit="mL/min"
                value={f.egfr}
                onChange={(v) => { set("egfr", v); setEgfrManual(true); }}
                step={1} min={1} max={120}
                danger={f.egfr && Number(f.egfr) < 15}
                warn={f.egfr && Number(f.egfr) >= 15 && Number(f.egfr) < 30}
              />
              {f.egfr && !egfrManual && (
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--brand-deep)", fontWeight: 600, lineHeight: 1.4 }}>
                  CKD-EPI 2021 ✓{suggestedStage && <span style={{ marginLeft: 6, color: "var(--ink-2)", fontWeight: 400 }}>→ {suggestedStage}</span>}
                </div>
              )}
              {f.egfr && egfrManual && (
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 4 }}>
                  กรอกเอง
                  <button type="button" onClick={() => setEgfrManual(false)}
                    style={{ fontSize: 10, border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", background: "var(--surface)", cursor: "pointer", color: "var(--brand-deep)" }}>
                    คำนวณใหม่
                  </button>
                </div>
              )}
            </div>

            <RenalDoseCalc age={f.age} scr={f.scr} sex={f.sex} onFill={(v) => { set("egfr", v); setEgfrManual(true); }} />

            {/* แนวโน้มผลแล็บแบบย่อ — ดูเทียบ visit ก่อนหน้าได้ทันทีขณะกรอก */}
            {prevVisits.length > 0 && typeof window.MultiLabTrend === "function" && (
              <div style={{ width: "100%", marginTop: 4 }}>
                <MultiLabTrend priorVisits={prevVisits} current={f} />
              </div>
            )}

            {/* K+ StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="K⁺" unit="mmol/L" value={f.k} onChange={(v) => set("k", v)} step={0.1} min={1.0} max={9.9}
                danger={f.k && Number(f.k) > 5.5}
                warn={f.k && Number(f.k) >= 5.0 && Number(f.k) <= 5.5}
              />
            </div>

            {/* Na+ StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="Na⁺" unit="mmol/L" value={f.na} onChange={(v) => set("na", v)} step={1} min={100} max={160} />
            </div>

            {/* Hb StepInput — anemia of CKD */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="Hb" unit="g/dL" value={f.hb} onChange={(v) => set("hb", v)} step={0.1} min={3} max={20}
                danger={f.hb && Number(f.hb) < 9} warn={f.hb && Number(f.hb) >= 9 && Number(f.hb) < 10} />
            </div>

            {/* HCO3 StepInput — metabolic acidosis */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="HCO₃⁻" unit="mEq/L" value={f.hco3} onChange={(v) => set("hco3", v)} step={1} min={5} max={40}
                danger={f.hco3 && Number(f.hco3) < 18} warn={f.hco3 && Number(f.hco3) >= 18 && Number(f.hco3) < 22} />
            </div>

            {/* Phosphate StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="PO₄" unit="mmol/L" value={f.phos} onChange={(v) => set("phos", v)} step={0.1} min={0.3} max={4}
                warn={f.phos && Number(f.phos) > 1.78} />
            </div>

            {/* Calcium StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="Ca" unit="mmol/L" value={f.ca} onChange={(v) => set("ca", v)} step={0.05} min={1} max={4}
                warn={f.ca && Number(f.ca) > 2.6} />
            </div>

            {/* UACR StepInput — albuminuria */}
            <div style={{ flex: "0 0 150px" }}>
              <StepInput label="UACR" unit="mg/g" value={f.uacr} onChange={(v) => set("uacr", v)} step={10} min={0} max={5000}
                warn={f.uacr && Number(f.uacr) >= 30 && Number(f.uacr) < 300} danger={f.uacr && Number(f.uacr) >= 300} />
            </div>

            {/* DM toggle — สำหรับ SGLT2i omission */}
            <div style={{ flex: "0 0 150px", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <button type="button" onClick={() => set("dm", !f.dm)}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${f.dm ? "var(--brand)" : "var(--border)"}`, background: f.dm ? "var(--brand)" : "var(--surface)", color: f.dm ? "#fff" : "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" }}>
                {f.dm ? "✓ " : ""}เบาหวาน (DM)
              </button>
            </div>

            {/* BP Row */}
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>ความดันโลหิต (mmHg)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <StepInput label="" value={f.bpSys} onChange={v => set('bpSys', v)} step={2} min={60} max={220} unit=""
                  warn={f.bpSys >= 130 && f.bpSys < 140} danger={f.bpSys >= 140} />
                <span style={{ fontSize: 20, fontWeight: 300, color: 'var(--ink-2)', marginTop: 4 }}>/</span>
                <StepInput label="" value={f.bpDia} onChange={v => set('bpDia', v)} step={2} min={40} max={140} unit=""
                  warn={f.bpDia >= 80 && f.bpDia < 90} danger={f.bpDia >= 90} />
                <span style={{ fontSize: 12, color: 'var(--ink-2)', alignSelf: 'flex-end', paddingBottom: 8 }}>mmHg</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['120','80','ปกติ','#16a34a'],['130','85','ปกติ-สูง','#d97706'],['140','90','HTN G1','#dc2626'],['160','100','HTN G2','#991b1b']].map(([s,d,label,col]) => (
                  <button key={label} type="button"
                    onClick={() => { set('bpSys', s); set('bpDia', d); }}
                    style={{ padding: '4px 10px', borderRadius: 99, border: `1px solid ${col}33`, background: `${col}12`, color: col, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                    {s}/{d} <span style={{ opacity: 0.7 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* HR StepInput */}
            <div style={{ flex: "0 0 130px" }}>
              <StepInput label="HR" unit="bpm" value={f.hr} onChange={(v) => set("hr", v)} step={1} min={30} max={200} />
            </div>

            <FloatInput label="การแพ้ยา" value={f.allergy} onChange={(e) => set("allergy", e.target.value)} placeholder="ระบุ หรือ -" style={{ flex: '1 1 200px' }} />
          </div>
        </FSection>
        </div>{/* /section-1-ref */}

        {/* ส่วนที่ 3 — BPML */}
        <div ref={el => sectionRefs.current['2'] = el}>
        <FSection n="3" title="รายการยาที่ถูกต้องและเป็นปัจจุบันที่สุด" en="Best Possible Medication List" defaultOpen
          badge={f.meds.filter((m) => m.drug).length + " รายการ"}>

          {/* แจ้งว่ายกยาเดิมมาให้แล้ว — เภสัชกรเพียงตรวจทาน/แก้ไขส่วนที่เปลี่ยน */}
          {f._carriedFromVisit && !initial?.id && (
            <div style={{ marginBottom: 12, padding: "11px 14px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-deep)", flex: 1 }}>
                ยกรายการยาเดิม{typeof f._carriedFromVisit === "string" ? ` จาก visit ${fmtDate(f._carriedFromVisit)}` : ""} มาให้แล้ว — โปรดตรวจทานและแก้ไขเฉพาะที่เปลี่ยนแปลง แล้วอัปเดตค่า Lab/สัญญาณชีพของครั้งนี้
              </span>
            </div>
          )}
          {/* Med Reconciliation Diff — เปรียบเทียบยาครั้งนี้กับ visit ที่แล้ว */}
          {isCarriedSeed && <MedDiffPanel prevMeds={initial?.meds || []} curMeds={f.meds} visitDate={f._carriedFromVisit} />}

          {/* Feature 1: global allergy warning at top of med section */}
          {hasAnyConflict && (
            <div style={{ marginBottom: 12, padding: "11px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#b91c1c", flex: 1 }}>
                พบยาในรายการที่อาจตรงกับ Allergy ที่บันทึกไว้ — กรุณาตรวจสอบก่อนจ่ายยา
              </span>
            </div>
          )}

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
                          {/* Feature 3: opens checkbox modal instead of immediate copy */}
                          <button type="button" onClick={() => copyFromVisit(r)}
                            style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px", color: "var(--brand-deep)", borderColor: "var(--brand)" }}>
                            <Icon name="pill" size={13} />📋 เลือกยา
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Search-first drug entry */}
          <MedSearchAdd onAdd={addDrugFromSearch} onAddBlank={addMed}
            existing={f.meds.map((m) => m.drug)} />

          {/* Visit template — เพิ่มยาที่พบบ่อยตามระยะ CKD อย่างรวดเร็ว (เภสัชกรแก้ไขขนาดเอง) */}
          {templateDrugs.length > 0 && (
            <div style={{ marginTop: 10, padding: "11px 14px", background: "var(--surface-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: "var(--brand-deep)" }}>
                <span>⚡</span> เพิ่มเร็ว — ยาที่พบบ่อยใน CKD {f.ckdStage}
                <span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 11.5 }}>(กดเพื่อเพิ่ม แล้วปรับขนาดเอง)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {templateDrugs.map((name) => {
                  const added = f.meds.some((m) => m.drug && m.drug.trim().toLowerCase() === name.toLowerCase());
                  return (
                    <button key={name} type="button" disabled={added} onClick={() => quickAddByName(name)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${added ? "var(--border)" : "var(--brand)"}`, background: added ? "var(--surface-2)" : "var(--surface)", color: added ? "var(--ink-2)" : "var(--brand-deep)", fontSize: 12.5, fontWeight: 600, cursor: added ? "default" : "pointer", fontFamily: "var(--sans)", opacity: added ? 0.6 : 1 }}>
                      {added ? "✓" : "+"} {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 1: DDI Alerts */}
          {React.useMemo(() => {
            const drugList = f.meds.filter(m => m.drug && m.drug.trim()).map(m => ({ name: m.drug }));
            if (drugList.length < 2 || typeof window.checkDDI !== "function") return null;
            const ddis = window.checkDDI(drugList);
            if (!ddis.length) return null;
            const majors = ddis.filter(d => d.severity === "major");
            const mods = ddis.filter(d => d.severity === "moderate");
            return (
              <div style={{ marginBottom: 12 }}>
                {majors.map((d, i) => (
                  <div key={"maj-" + i} style={{ marginBottom: 6, padding: "10px 13px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 10, fontSize: 12.5, color: "#b91c1c", fontWeight: 600 }}>
                    🔴 DDI Major: <strong>{d.drugA}</strong> + <strong>{d.drugB}</strong><br />
                    <span style={{ fontWeight: 400 }}>{d.message}</span>
                  </div>
                ))}
                {mods.map((d, i) => (
                  <div key={"mod-" + i} style={{ marginBottom: 6, padding: "10px 13px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 10, fontSize: 12.5, color: "#92400e", fontWeight: 600 }}>
                    🟡 DDI Moderate: <strong>{d.drugA}</strong> + <strong>{d.drugB}</strong><br />
                    <span style={{ fontWeight: 400 }}>{d.message}</span>
                  </div>
                ))}
              </div>
            );
          }, [f.meds])}

          {/* Added medication cards */}
          {f.meds.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {f.meds.map((m, i) => (
                <MedCard
                  key={i} i={i} m={m} setMed={setMed} setMedFields={setMedFields}
                  egfr={f.egfr}
                  del={() => delMed(i)}
                  allergyConflict={allergyConflicts[i]}
                />
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 14, padding: "26px 18px", textAlign: "center", border: "1.5px dashed var(--border)", borderRadius: 12, background: "var(--surface-2)" }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>💊</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>ยังไม่มีรายการยา</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3 }}>พิมพ์ชื่อยาในช่องค้นหาด้านบนเพื่อเพิ่มได้อย่างรวดเร็ว</div>
            </div>
          )}

          <HerbOtcSection items={f.otcItems || []} onChange={(v) => set("otcItems", v)} />
        </FSection>
        </div>{/* /section-2-ref */}

        {/* DRP Auto-analysis panel — single source of truth */}
        <DrpAnalysisPanel meds={f.meds} otcItems={f.otcItems || []} egfr={f.egfr} k={f.k} ckdStage={f.ckdStage}
          hb={f.hb} hco3={f.hco3} phos={f.phos} ca={f.ca} bpSys={f.bpSys} bpDia={f.bpDia} uacr={f.uacr} dm={f.dm}
          age={f.age} followUp={f.followUp} allergy={f.allergy}
          acks={f.drpAcks || {}} user={user} counselingNote={f.counselingNote}
          unackedHigh={unackedHighFindings}
          onAck={(fid, val) => setF((p) => { const a = { ...(p.drpAcks || {}) }; if (val) a[fid] = val; else delete a[fid]; return { ...p, drpAcks: a }; })}
          onCounsel={(note) => setF((p) => ({ ...p, counselingNote: note, interventions: [...new Set([...(p.interventions || []), "counsel"])] }))}
          onFindings={handleDrpFindings} />

        {/* ส่วนที่ 4 */}
        <div ref={el => sectionRefs.current['4'] = el}>
        <FSection n="4" title="ประเมินความปลอดภัยด้านยาใน CKD" en="CKD Safety Screening" defaultOpen
          badge={finalDrpKeys.length ? finalDrpKeys.length + " ปัญหา" : null} badgeTone={finalDrpKeys.length ? "danger" : null}>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.5 }}>
            รายการ DRP มาจากการวิเคราะห์อัตโนมัติ (ป้าย <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "var(--brand)", color: "#fff", verticalAlign: "middle" }}>AUTO</span>) — เภสัชกรเพิ่ม/เอาออกได้เอง
          </div>
          {/* Feature: DRP outcome loop — ติดตามผล DRP จาก visit ก่อนหน้า */}
          {(() => {
            const prevDrps = (prevVisits[0] && Array.isArray(prevVisits[0].drps)) ? prevVisits[0].drps : [];
            if (!prevDrps.length) return null;
            const STATUS = [
              { v: "resolved", t: "แก้ไขแล้ว", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
              { v: "ongoing", t: "ยังมีอยู่", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
              { v: "worsened", t: "แย่ลง", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            ];
            const setOutcome = (key, v) => setF((p) => ({ ...p, drpFollowup: { ...(p.drpFollowup || {}), [key]: v } }));
            return (
              <div style={{ marginBottom: 16, padding: "13px 15px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  🔄 ติดตามผล DRP จาก visit ก่อน ({fmtDate(prevVisits[0].date)})
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 10 }}>ระบุสถานะของปัญหาที่พบครั้งก่อน เพื่อปิด loop การดูแล</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {prevDrps.map((key) => {
                    const label = (typeof window.drpLabel === "function") ? window.drpLabel(key) : key;
                    const cur = (f.drpFollowup || {})[key];
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: "var(--ink)" }}>{label}</span>
                        <div style={{ display: "flex", gap: 5 }}>
                          {STATUS.map((s) => (
                            <button key={s.v} type="button" onClick={() => setOutcome(key, s.v)}
                              style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)",
                                border: `1.5px solid ${cur === s.v ? s.color : "var(--border)"}`,
                                background: cur === s.v ? s.bg : "var(--surface)",
                                color: cur === s.v ? s.color : "var(--ink-2)" }}>
                              {s.t}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <DrpChipSelector autoKeys={autoDrpKeys} selectedKeys={finalDrpKeys} onToggle={toggleDrpKey} />
          {finalDrpKeys.length > 0 && (
            <Field label="รายละเอียดปัญหาด้านยา (DRP)" style={{ marginTop: 14 }}>
              <textarea style={{ ...inS, minHeight: 64, resize: "vertical" }} value={f.drpDetail} onChange={(e) => set("drpDetail", e.target.value)} placeholder="อธิบายปัญหาที่พบ..." />
            </Field>
          )}
        </FSection>
        </div>{/* /section-4-ref */}

        {/* ส่วนที่ 2 */}
        <div ref={el => sectionRefs.current['3'] = el}>
        <FSection n="2" title="แหล่งข้อมูลที่ใช้" en="Information Sources" badge={f.sources.length ? f.sources.length : null}>
          <ChipGroup options={SOURCE_OPTIONS} selected={f.sources} onToggle={(k) => toggle("sources", k)} />
          <Field label="อื่น ๆ" style={{ marginTop: 12 }}><input style={inS} value={f.sourceOther} onChange={(e) => set("sourceOther", e.target.value)} placeholder="ระบุแหล่งข้อมูลอื่น" /></Field>
        </FSection>
        </div>{/* /section-3-ref */}

        {/* ส่วนที่ 5 */}
        <div ref={el => sectionRefs.current['5'] = el}>
        <FSection n="5" title="Medication Reconciliation" en="การกระทบยอดรายการยา" open={openRecon} onToggle={() => setOpenRecon((o) => !o)}>
          {prevVisits.length > 0 && <MedDiffPanel prev={prevVisits[0]} curMeds={f.meds} />}
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
              <div style={{ marginTop: 12 }}><FloatInput label="แพทย์ผู้รับผิดชอบ" value={f.physician} onChange={(e) => set("physician", e.target.value)} /></div>
            </>
          )}
        </FSection>
        </div>{/* /section-5-ref */}

        {/* นัดติดตาม */}
        <div ref={el => sectionRefs.current['6'] = el}>
        <FSection n="•" title="นัดติดตามผู้ป่วย" en="Follow-up reminder" open={openFollow} onToggle={() => { const n = !openFollow; setOpenFollow(n); if (n && !f.followUp) set("followUp", { due: "", note: "" }); if (!n) set("followUp", null); }}>
          {/* Smart Follow-up Suggestion */}
          {(() => {
            function suggestFollowUp(stage, egfr, drpFindings, k) {
              const eg = parseFloat(egfr);
              const kv = parseFloat(k);
              let days = 180; // default G1-2: 6 months
              let reason = "CKD ระยะต้น";
              if (stage === "5" || (eg && eg < 15)) { days = 30; reason = "CKD G5 — ติดตามรายเดือน"; }
              else if (stage === "4" || (eg && eg < 30)) { days = 60; reason = "CKD G4 — ติดตาม 2 เดือน"; }
              else if (stage === "3b" || (eg && eg < 45)) { days = 90; reason = "CKD G3b — ติดตาม 3 เดือน"; }
              else if (stage === "3a" || (eg && eg < 60)) { days = 90; reason = "CKD G3a — ติดตาม 3 เดือน"; }
              // High-risk DRP overrides to 2 weeks
              const hasHighDrp = (drpFindings || []).some(fd => fd.sev === "HIGH");
              if (hasHighDrp) { days = Math.min(days, 14); reason = "พบ DRP ความเสี่ยงสูง — ติดตาม 2 สัปดาห์"; }
              // Hyperkalemia overrides to 4 weeks
              if (kv && kv > 5.5) { days = Math.min(days, 28); reason = "K⁺ > 5.5 — ติดตาม 4 สัปดาห์"; }
              return { days, reason, date: isoAddDays(days) };
            }
            const sug = suggestFollowUp(f.ckdStage, f.egfr, drpFindings, f.k);
            return (
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Icon name="clock" size={15} color="#0d9488" />
                <span style={{ fontSize: 13, color: "#0f766e", flex: 1 }}>แนะนำ: <strong>{fmtDate(sug.date)}</strong> — {sug.reason}</span>
                <button type="button" onClick={() => { set("followUp", { due: sug.date, note: sug.reason }); setOpenFollow(true); }}
                  style={{ padding: "5px 14px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>
                  ใช้วันนี้
                </button>
              </div>
            );
          })()}
          <div style={fGrid}>
            <Field label="วันที่นัดติดตาม" w={180}><input type="date" style={inS} value={f.followUp?.due || ""} onChange={(e) => set("followUp", { ...(f.followUp || {}), due: e.target.value })} /></Field>
            <Field label="หมายเหตุการติดตาม" grow><input style={inS} value={f.followUp?.note || ""} onChange={(e) => set("followUp", { ...(f.followUp || {}), note: e.target.value })} placeholder="เช่น ติดตามผล K⁺..." /></Field>
          </div>
        </FSection>
        </div>{/* /section-6-ref */}

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>
          <Icon name="user" size={18} color="var(--brand-deep)" />
          เภสัชกรผู้บันทึก: <strong style={{ color: "var(--ink)" }}>{f.pharmacist}</strong>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 12 }}>{f.time || "บันทึกเวลาอัตโนมัติ"}</span>
        </div>

        {/* DRP pre-save summary — driven by the same drpFindings already computed above */}
        {(()=>{
          const high = drpFindings.filter(x=>x.sev==="HIGH").length;
          const med  = drpFindings.filter(x=>x.sev==="MED").length;
          const low  = drpFindings.filter(x=>x.sev==="LOW").length;
          const total = drpFindings.length;
          const bg = total ? (high ? "#fef3c7" : "#fff7ed") : "#f0fdf4";
          const border = total ? (high ? "#fcd34d" : "#fdba74") : "#bbf7d0";
          const icon = total ? (high ? "⚠️" : "ℹ️") : "✅";
          const headline = total ? `พบ ${total} รายการ` : "ไม่พบ DRP";
          return (
            <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: total?8:0 }}>
                <span style={{fontSize:18}}>{icon}</span>
                <span style={{fontWeight:800, fontSize:14.5, color: total?(high?"#92400e":"#c2410c"):"#166534"}}>สรุป DRP ที่ตรวจพบ</span>
                <span style={{marginLeft:"auto", fontWeight:700, fontSize:13, color:"#374151"}}>{headline}</span>
                {high>0 && <span style={{background:"#dc2626",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11.5,fontWeight:700}}>HIGH ×{high}</span>}
                {med>0  && <span style={{background:"#f59e0b",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11.5,fontWeight:700}}>MED ×{med}</span>}
                {low>0  && <span style={{background:"#3b82f6",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11.5,fontWeight:700}}>LOW ×{low}</span>}
              </div>
              {total>0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {drpFindings.map((fd,i)=>{
                    const sevColor = fd.sev==="HIGH"?"#dc2626":fd.sev==="MED"?"#d97706":"#2563eb";
                    const label = typeof window.drpLabel==="function" ? window.drpLabel(fd.drpKey) : fd.drpKey;
                    return (
                      <span key={i} style={{background:"#fff",border:`1.5px solid ${sevColor}`,color:sevColor,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                        {label} {fd.drug ? `(${fd.drug})` : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* sticky bottom bar */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -6px 20px rgba(0,0,0,.05)", padding: "12px clamp(18px,2.4vw,30px)", zIndex: 20 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>ระดับความเสี่ยง</span>
            <RiskBadge band={risk.band} score={risk.score} />
            <span style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.3 }}>{risk.factors.slice(0, 2).map((x) => x.t).join(" · ") || "ยังไม่มีปัจจัยเสี่ยง"}</span>
          </div>
          <button onClick={(e) => { if (valid && !saving) { if (window.addRipple) window.addRipple(e); save(); } }}
            disabled={!valid || saving}
            style={{ ...primaryBtn,
              opacity: valid && !saving ? 1 : .45,
              cursor: valid && !saving ? "pointer" : "not-allowed",
              background: saved
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : "linear-gradient(135deg,var(--brand),var(--brand-deep))",
              transition: "background 0.3s, transform 0.15s, box-shadow 0.2s",
              transform: saving ? "scale(0.97)" : "scale(1)",
              boxShadow: valid && !saving ? "0 4px 16px rgba(13,148,136,.4)" : "none",
              position: "relative", overflow: "hidden",
            }}>
            {saved
              ? <><span className="save-check-morph">✓</span> บันทึกสำเร็จ!</>
              : saving
                ? <><span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite" }} />กำลังบันทึก...</>
                : <><Icon name="check" size={18} color="#fff" /> บันทึกข้อมูล <span style={{ fontSize: 10.5, opacity: .8, fontWeight: 500, marginLeft: 2 }}>⌘/Ctrl+S</span></>}
          </button>
        </div>
        {!valid && <div style={{ maxWidth: 1080, margin: "6px auto 0", fontSize: 11.5, color: "#b45309" }}>กรอก HN, ชื่อ-สกุล และเลือก CKD stage เพื่อบันทึก</div>}
        {valid && labWarnings.length > 0 && (
          <div style={{ maxWidth: 1080, margin: "8px auto 0", display: "flex", alignItems: "flex-start", gap: 8,
            fontSize: 11.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, padding: "7px 11px" }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>ค่าที่ควรตรวจสอบ ({labWarnings.length}): {labWarnings.join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Strength pill picker ---------- */
function StrengthPicker({ drug, value, onChange }) {
  const info = lookupDrug(drug);
  const options = info ? info.strengths : [];
  const [custom, setCustom] = React.useState(false);

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

/* ---------- Drug info card ---------- */
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

/* ---------- Drug search (name + class, recent-boosted) ---------- */
function searchDrugs(q) {
  const ql = q.toLowerCase().trim();
  if (!ql) return [];
  const rec = RecentDrugs.get();
  const aliasMap = (typeof DRUG_ALIASES !== "undefined") ? DRUG_ALIASES : {};
  return DRUG_DB
    .map((d) => {
      const n = d.name.toLowerCase();
      const c = (d.cls || "").toLowerCase();
      const aliases = (aliasMap[d.name] || []).map((a) => a.toLowerCase());
      let score = -1;
      if (n.startsWith(ql)) score = 100;
      else if (aliases.some((a) => a.startsWith(ql))) score = 70;
      else if (n.includes(ql)) score = 60;
      else if (aliases.some((a) => a.includes(ql))) score = 50;
      else if (c.includes(ql)) score = 30;
      if (score >= 0 && rec.includes(d.name)) score += 8;
      return { d, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.d);
}

/* ---------- MedSearchAdd — search-first medication entry ---------- */
function MedSearchAdd({ onAdd, onAddBlank, existing }) {
  const [q, setQ] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);

  const recents = React.useMemo(() => {
    const rec = RecentDrugs.get();
    return rec.map((n) => DRUG_DB.find((d) => d.name === n)).filter(Boolean).slice(0, 6);
  }, [focus]);

  const matches = q.trim() ? searchDrugs(q.trim()) : recents;
  const showDrop = focus && matches.length > 0;

  React.useEffect(() => { setActive(0); }, [q]);

  function pick(d) {
    onAdd(d);
    setQ("");
    setActive(0);
    if (inputRef.current) inputRef.current.focus(); // keep focus for rapid multi-add
  }

  function onKeyDown(e) {
    if (!showDrop) {
      if (e.key === "Enter" && q.trim()) { e.preventDefault(); onAddBlank(); setQ(""); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[active]) pick(matches[active]); }
    else if (e.key === "Escape") { setFocus(false); }
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
            <Icon name="search" size={18} color="var(--brand)" />
          </span>
          <input
            ref={inputRef} value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 160)}
            onKeyDown={onKeyDown}
            placeholder="ค้นหายา — พิมพ์ชื่อหรือกลุ่มยา เช่น Enalapril, ARB, Metformin…"
            style={{
              width: "100%", padding: "13px 14px 13px 42px",
              border: `1.5px solid ${focus ? "var(--brand)" : "var(--border)"}`,
              borderRadius: 11, fontSize: 14.5, fontFamily: "var(--sans)",
              color: "var(--ink)", background: "var(--surface)", outline: "none",
              boxShadow: focus ? "0 0 0 3px color-mix(in srgb,var(--brand) 14%,transparent)" : "none",
              transition: "border-color .15s, box-shadow .15s", boxSizing: "border-box",
            }}
          />
        </div>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); onAddBlank(); setQ(""); }}
          title="เพิ่มยาที่ไม่อยู่ในระบบ (กรอกเอง)"
          style={{ ...ghostBtn, borderStyle: "dashed", whiteSpace: "nowrap", padding: "0 14px" }}>
          <Icon name="plus" size={16} /> กรอกเอง
        </button>
      </div>

      {showDrop && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6,
          maxHeight: 420, overflowY: "auto", zIndex: 9000,
          background: "var(--surface)", border: "1.5px solid var(--brand)",
          borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        }}>
          <div style={{ padding: "9px 14px 7px", fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, position: "sticky", top: 0 }}>
            <span>{q.trim() ? "🔍 ผลการค้นหา" : "🕑 ยาที่ใช้บ่อย"}</span>
            <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 10 }}>{matches.length} รายการ · ↑↓ เลือก · Enter เพิ่ม</span>
          </div>
          {matches.map((d, idx) => {
            const added = (existing || []).includes(d.name);
            const danger = (d.flags || []).includes("contra") || (d.flags || []).includes("nephrotoxic");
            return (
              <div key={d.name} onMouseDown={() => pick(d)} onMouseEnter={() => setActive(idx)}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: idx === active ? "var(--brand-soft)" : "var(--surface)",
                  borderLeft: `3px solid ${idx === active ? "var(--brand)" : "transparent"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{d.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 5, background: "var(--brand-soft)", color: "var(--brand-deep)", border: "1px solid color-mix(in srgb,var(--brand) 30%,transparent)" }}>{d.cls}</span>
                  <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    {added && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand-deep)" }}>เพิ่มแล้ว ✓</span>}
                    {(d.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}
                  </span>
                </div>
                {d.strengths && d.strengths.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {d.strengths.map((s) => (
                      <span key={s} style={{ fontSize: 11, fontFamily: "var(--mono)", padding: "1px 6px", borderRadius: 5, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-2)" }}>{s}</span>
                    ))}
                  </div>
                )}
                {d.note && <div style={{ fontSize: 11, color: danger ? "#b91c1c" : "var(--ink-2)", lineHeight: 1.4, marginTop: 4 }}>{danger ? "⚠️ " : ""}{d.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Structured dose entry ---------- */
const QTY_OPTS = [0.5, 1, 1.5, 2, 3];
const FREQ_DAY_OPTS = [1, 2, 3, 4];
const TIMING_OPTS = [["pc", "หลังอาหาร"], ["ac", "ก่อนอาหาร"], ["hs", "ก่อนนอน"], ["prn", "เมื่อมีอาการ"], ["เช้า", "เช้า"], ["เย็น", "เย็น"]];

function buildDoseStr(qty, freq, timing) {
  const q = parseFloat(qty), fr = parseFloat(freq);
  if (!q || !fr) return timing || "";
  return `${q}x${fr}${timing ? " " + timing : ""}`;
}

function unitOfStrength(strength, maxInfo) {
  if (maxInfo && maxInfo.unit) return maxInfo.unit;
  const m = String(strength || "").match(/(mcg|mg|g|IU|ml)/i);
  return m ? m[1] : "mg";
}

// DoseInput — quick qty × freq + timing picker; writes structured fields + display string
function DoseInput({ m, onChange, qtyKey = "qtyPerDose", freqKey = "freqPerDay", timingKey = "timing", doseKey = "dose", compact }) {
  const qty = m[qtyKey], freq = m[freqKey], timing = m[timingKey];
  const looksStructured = (qty && freq) || /\d+(?:\.\d+)?\s*[xX×]\s*\d/.test(m[doseKey] || "");
  const [freeMode, setFreeMode] = React.useState(() => !!(m[doseKey] && !looksStructured));

  function update(part) {
    const q = part.qty !== undefined ? part.qty : qty;
    const fr = part.freq !== undefined ? part.freq : freq;
    const tm = part.timing !== undefined ? part.timing : timing;
    onChange({ [qtyKey]: q, [freqKey]: fr, [timingKey]: tm, [doseKey]: buildDoseStr(q, fr, tm) });
  }

  if (freeMode) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <input style={{ ...inS, flex: 1 }} value={m[doseKey] || ""}
          onChange={(e) => onChange({ [doseKey]: e.target.value })}
          placeholder="เช่น ตามแพทย์สั่ง, ค่อยๆ ลดขนาด…" />
        <button type="button" onClick={() => setFreeMode(false)} title="กลับไปเลือกแบบเร็ว"
          style={{ border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", cursor: "pointer", padding: "0 9px", color: "var(--brand-deep)", fontSize: 11, whiteSpace: "nowrap" }}>เลือก</button>
      </div>
    );
  }

  const chip = (on, c) => ({ padding: "6px 11px", borderRadius: 7, border: `1.5px solid ${on ? c : "var(--border)"}`, background: on ? c : "var(--surface)", color: on ? "#fff" : "var(--ink-2)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 600 }}>เม็ด/ครั้ง</span>
        {QTY_OPTS.map((q) => (
          <button key={q} type="button" onClick={() => update({ qty: q })} style={chip(parseFloat(qty) === q, "var(--brand)")}>{q}</button>
        ))}
        <input value={qty && !QTY_OPTS.includes(parseFloat(qty)) ? qty : ""} onChange={(e) => update({ qty: e.target.value })}
          inputMode="decimal" placeholder="อื่น ๆ"
          style={{ width: 56, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12.5, fontFamily: "var(--mono)", textAlign: "center", background: "var(--surface)", color: "var(--ink)", outline: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 600 }}>× ครั้ง/วัน</span>
        {FREQ_DAY_OPTS.map((fr) => (
          <button key={fr} type="button" onClick={() => update({ freq: fr })} style={chip(parseFloat(freq) === fr, "var(--brand-deep)")}>{fr}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {TIMING_OPTS.map(([v, t]) => (
          <button key={v} type="button" onClick={() => update({ timing: v === timing ? "" : v })}
            style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${timing === v ? "var(--accent)" : "var(--border)"}`, background: timing === v ? "var(--brand-soft)" : "var(--surface)", color: timing === v ? "var(--brand-deep)" : "var(--ink-2)", fontSize: 11.5, cursor: "pointer" }}>{v} <span style={{ opacity: .65 }}>{t}</span></button>
        ))}
        <button type="button" onClick={() => setFreeMode(true)} title="พิมพ์เอง"
          style={{ padding: "5px 8px", borderRadius: 7, border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--ink-2)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>✏️ พิมพ์เอง</button>
      </div>
    </div>
  );
}

// RenalDoseHint — แสดงขนาดสูงสุดที่ปรับตาม eGFR + คำแนะนำคลินิก (guidance ก่อนกรอกขนาด)
function RenalDoseHint({ drug, egfr, info }) {
  if (!drug || !drug.trim()) return null;
  const maxInfo = (typeof window.maxDailyDoseFor === "function") ? window.maxDailyDoseFor(drug, egfr) : null;
  const note = info && info.note;
  if (!maxInfo && !note) return null;
  const eg = parseFloat(egfr);
  const avoid = maxInfo && maxInfo.renal && maxInfo.max === 0;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, padding: "7px 11px", borderRadius: 8, background: avoid ? "#fef2f2" : "var(--surface-2)", border: `1px solid ${avoid ? "#fca5a5" : "var(--border)"}` }}>
      {maxInfo && (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: avoid ? "#b91c1c" : "var(--brand-deep)" }}>
          {avoid
            ? `⛔ ไม่ควรใช้ที่ eGFR ${isNaN(eg) ? "?" : eg} (ปรับตามไตแล้ว = ห้ามใช้)`
            : `💡 ขนาดสูงสุดแนะนำ${maxInfo.renal && !isNaN(eg) ? ` ที่ eGFR ${eg}` : ""}: ${Math.round(maxInfo.max * 100) / 100} ${maxInfo.unit}/วัน`}
        </div>
      )}
      {note && <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

// DailyDoseReadout — live total mg/day + overdose warning
function DailyDoseReadout({ drug, strength, qty, freq, dose, egfr, label = "ขนาดรวม" }) {
  const daily = (typeof window.dailyDoseMg === "function") ? window.dailyDoseMg(strength, qty, freq, dose) : NaN;
  if (isNaN(daily) || daily <= 0) return null;
  const maxInfo = (typeof window.maxDailyDoseFor === "function") ? window.maxDailyDoseFor(drug, egfr) : null;
  const unit = unitOfStrength(strength, maxInfo);
  const over = maxInfo && maxInfo.max > 0 && daily > maxInfo.max + 0.001;
  const dispDaily = Math.round(daily * 100) / 100;
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 8,
        background: over ? "#fef2f2" : "var(--brand-soft)", border: `1px solid ${over ? "#fca5a5" : "color-mix(in srgb,var(--brand) 30%,transparent)"}`,
        color: over ? "#b91c1c" : "var(--brand-deep)", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--mono)" }}>
        {over ? "⚠️" : "Σ"} {label} {dispDaily} {unit}/วัน
      </span>
      {maxInfo && maxInfo.max > 0 && (
        <span style={{ fontSize: 11.5, color: over ? "#b91c1c" : "var(--ink-2)", fontWeight: over ? 700 : 500 }}>
          {over
            ? `เกินขนาดสูงสุด ${maxInfo.renal ? `(eGFR ${egfr})` : ""} ${Math.round(maxInfo.max * 100) / 100} ${unit}/วัน`
            : `สูงสุด ${maxInfo.renal ? `(eGFR ${egfr})` : ""} ${Math.round(maxInfo.max * 100) / 100} ${unit}/วัน`}
        </span>
      )}
    </div>
  );
}

// ActualIntake — what the patient really takes (drives adherence + actual-overdose DRP)
/* ---------- MedDiffPanel — side-by-side ยาเดิม vs ยาใหม่ เมื่อ carry-forward ---------- */
function MedDiffPanel({ prevMeds, curMeds, visitDate }) {
  const [open, setOpen] = React.useState(false);
  if (!prevMeds.length && !curMeds.length) return null;
  const diff = (typeof window.diffMedLists === "function")
    ? window.diffMedLists(prevMeds, curMeds)
    : { added: [], stopped: [], changed: [], unchanged: 0 };
  const total = diff.added.length + diff.stopped.length + diff.changed.length;
  const badge = (label, count, col, bg) => count > 0 && (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 9px", borderRadius:99,
      fontSize:11.5, fontWeight:700, color:col, background:bg, border:`1px solid ${col}44` }}>
      {label} {count}
    </span>
  );
  return (
    <div style={{ marginBottom: 12, border: "1px solid #e0f2f1", borderRadius: 11, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
          background: open ? "#f0fdfa" : "#f8fffe", border:"none", cursor:"pointer", textAlign:"left", fontFamily:"var(--sans)" }}>
        <Icon name="pill" size={15} color="#0d9488" />
        <span style={{ fontSize:13, fontWeight:700, color:"#0f766e", flex:1 }}>
          เปรียบเทียบยากับ visit{typeof visitDate === "string" ? ` ${fmtDate(visitDate)}` : "ที่แล้ว"}
        </span>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {badge("ยาใหม่", diff.added.length, "#16a34a", "#f0fdf4")}
          {badge("หยุดยา", diff.stopped.length, "#dc2626", "#fef2f2")}
          {badge("เปลี่ยนขนาด", diff.changed.length, "#d97706", "#fffbeb")}
          {total === 0 && <span style={{ fontSize:11.5, color:"#16a34a", fontWeight:600 }}>ไม่มีการเปลี่ยนแปลง ✓</span>}
        </div>
        <Icon name="chevronR" size={14} color="#0d9488" style={{ transform: open ? "rotate(90deg)" : "none", transition:"transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ padding:"12px 14px", background:"#fafffe", borderTop:"1px solid #e0f2f1", display:"flex", flexDirection:"column", gap:6, animation:"fadeUp 0.2s ease-out both" }}>
          {diff.added.map((m, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8 }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#16a34a", padding:"1px 6px", background:"#dcfce7", borderRadius:4 }}>ยาใหม่</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{m.drug}</span>
              {m.strength && <span style={{ fontSize:12, color:"var(--ink-2)" }}>{m.strength}</span>}
            </div>
          ))}
          {diff.stopped.map((m, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8 }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#dc2626", padding:"1px 6px", background:"#fee2e2", borderRadius:4 }}>หยุดยา</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)", textDecoration:"line-through", opacity:.7 }}>{m.drug}</span>
              {m.strength && <span style={{ fontSize:12, color:"var(--ink-2)" }}>{m.strength}</span>}
            </div>
          ))}
          {diff.changed.map((m, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#d97706", padding:"1px 6px", background:"#fef3c7", borderRadius:4 }}>เปลี่ยนขนาด</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{m.drug}</span>
              <span style={{ fontSize:12, color:"var(--ink-2)", fontFamily:"var(--mono)" }}>{m.from}</span>
              <span style={{ fontSize:12, color:"#d97706" }}>→</span>
              <span style={{ fontSize:12, color:"#b45309", fontWeight:700, fontFamily:"var(--mono)" }}>{m.to}</span>
            </div>
          ))}
          {diff.unchanged > 0 && (
            <div style={{ fontSize:12, color:"var(--ink-2)", padding:"4px 10px" }}>ไม่เปลี่ยนแปลง {diff.unchanged} รายการ</div>
          )}
        </div>
      )}
    </div>
  );
}

function ActualIntake({ m, onChange, drug, strength, egfr }) {
  const same = m.sameAsPrescribed !== false;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>ผู้ป่วยกินจริง</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button"
            onClick={() => onChange({ sameAsPrescribed: true, actualQty: "", actualFreq: "", actuallyTaking: "" })}
            style={segBtn(same, false)}>กินตามที่สั่ง</button>
          <button type="button"
            onClick={() => onChange({ sameAsPrescribed: false })}
            style={segBtn(!same, true)}>กินต่างจากสั่ง</button>
        </div>
      </div>
      {!same && (
        <div style={{ marginTop: 8 }}>
          <DoseInput m={m} onChange={onChange}
            qtyKey="actualQty" freqKey="actualFreq" timingKey="actualTiming" doseKey="actuallyTaking" />
          <DailyDoseReadout drug={drug} strength={strength}
            qty={m.actualQty} freq={m.actualFreq} dose={m.actuallyTaking} egfr={egfr} label="กินจริงรวม" />
        </div>
      )}
    </div>
  );
}

/* ---------- MedCard — compact, clear medication card ---------- */
function MedCard({ i, m, setMed, setMedFields, egfr, del, allergyConflict }) {
  const info = lookupDrug(m.drug);
  const hasConflict = allergyConflict && allergyConflict.conflict;
  const danger = (m.flags || []).includes("contra") || (m.flags || []).includes("nephrotoxic");
  const accent = hasConflict || danger ? "#dc2626" : "var(--brand)";

  // Feature 2: Dose adjustment alert
  const doseAdj = React.useMemo(() => {
    if (!m.drug || !egfr || typeof window.checkDoseAdjustment !== "function") return null;
    return window.checkDoseAdjustment(m.drug, egfr);
  }, [m.drug, egfr]);

  // Feature 3: Contraindication check
  const contraChk = React.useMemo(() => {
    if (!m.drug || !egfr || typeof window.checkContraindicated !== "function") return null;
    return window.checkContraindicated(m.drug, egfr);
  }, [m.drug, egfr]);

  const hasDoseAlert = doseAdj !== null;
  const hasContraAlert = contraChk !== null;

  return (
    <div style={{
      border: `1px solid ${hasConflict ? "#fca5a5" : "var(--border)"}`,
      borderLeft: `4px solid ${accent}`,
      borderRadius: 12, background: "var(--surface)", position: "relative",
      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    }}>
      {hasConflict && (
        <div style={{ padding: "8px 14px", background: "#fef2f2", borderBottom: "1px solid #fca5a5", borderRadius: "8px 0 0 0", fontSize: 12.5, fontWeight: 700, color: "#b91c1c", display: "flex", alignItems: "center", gap: 7 }}>
          ⚠️ เตือนแพ้ยา: {allergyConflict.reason}
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
          {info ? (
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{m.drug}</span>
          ) : (
            <input style={{ ...inS, flex: 1, fontWeight: 700, maxWidth: 280 }} value={m.drug}
              onChange={(e) => setMed(i, "drug", e.target.value)} placeholder="ชื่อยา (กรอกเอง)…" />
          )}
          {info && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "var(--brand-soft)", color: "var(--brand-deep)", border: "1px solid color-mix(in srgb,var(--brand) 30%,transparent)" }}>{info.cls}</span>}
          {/* Feature 3: Contraindicated badge */}
          {hasContraAlert && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: contraChk.level === "contraindicated" ? "#fef2f2" : "#fffbeb", color: contraChk.level === "contraindicated" ? "#b91c1c" : "#b45309", border: `1px solid ${contraChk.level === "contraindicated" ? "#fca5a5" : "#fcd34d"}`, flexShrink: 0 }}>
              {contraChk.level === "contraindicated" ? "⛔ ห้ามใช้" : "⚠️ ระวัง"}
            </span>
          )}
          <span style={{ display: "flex", gap: 5, marginLeft: "auto", flexShrink: 0 }}>{(m.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}</span>
          <button type="button" onClick={del} title="ลบรายการนี้" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-2)", padding: 4, flexShrink: 0 }}><Icon name="x" size={17} /></button>
        </div>
        {/* Feature 3: Contraindication detail alert */}
        {hasContraAlert && (
          <div style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 7, background: contraChk.level === "contraindicated" ? "#fef2f2" : "#fffbeb", border: `1px solid ${contraChk.level === "contraindicated" ? "#fca5a5" : "#fcd34d"}`, fontSize: 12, color: contraChk.level === "contraindicated" ? "#b91c1c" : "#92400e", fontWeight: 600 }}>
            {contraChk.level === "contraindicated" ? "⛔" : "⚠️"} {contraChk.message}
          </div>
        )}
        {/* Feature 2: Dose adjustment alert */}
        {hasDoseAlert && (
          <div style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 7, background: doseAdj.level === "avoid" ? "#fef2f2" : "#fffbeb", border: `1px solid ${doseAdj.level === "avoid" ? "#fca5a5" : "#fcd34d"}`, fontSize: 12, color: doseAdj.level === "avoid" ? "#b91c1c" : "#92400e", fontWeight: 600 }}>
            💊 ปรับขนาด: {doseAdj.message}
          </div>
        )}

        {/* Body — strength + structured dose */}
        <div style={{ paddingLeft: 33 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 150px" }}>
              <MiniLabel>ความแรง</MiniLabel>
              <StrengthPicker drug={m.drug} value={m.strength} onChange={(v) => setMed(i, "strength", v)} />
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <MiniLabel>ขนาด/วิธีใช้ (แพทย์สั่ง)</MiniLabel>
              <DoseInput m={m} onChange={(obj) => setMedFields(i, obj)} />
            </div>
          </div>

          {/* renal-dose quick reference (ปรากฏแม้ยังไม่กรอกขนาด) */}
          <RenalDoseHint drug={m.drug} egfr={egfr} info={info} />

          {/* live total daily dose readout + overdose warning */}
          <DailyDoseReadout drug={m.drug} strength={m.strength}
            qty={m.qtyPerDose} freq={m.freqPerDay} dose={m.dose} egfr={egfr} />

          {/* actual intake */}
          <ActualIntake m={m} onChange={(obj) => setMedFields(i, obj)} drug={m.drug} strength={m.strength} egfr={egfr} />
        </div>

        {m.flags && m.flags.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 9, paddingLeft: 33, flexWrap: "wrap" }}>
            {m.flags.map((fl) => <FlagTag key={fl} fl={fl} />)}
          </div>
        )}
        {m.drug && info && info.note && <DrugInfoCard drug={m.drug} />}
      </div>
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
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", marginBottom: 14 }}>
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

/* ---------- DrpChipSelector — grouped DRP_OPTIONS, EN primary/TH secondary, auto badge ---------- */
const DRP_GROUP_ORDER = ["Indication", "Effectiveness", "Safety", "Monitoring", "Process / Use"];
function DrpChipSelector({ autoKeys, selectedKeys, onToggle }) {
  const autoSet = new Set(autoKeys || []);
  const selSet = new Set(selectedKeys || []);
  const grouped = {};
  DRP_OPTIONS.forEach((o) => { (grouped[o.group] = grouped[o.group] || []).push(o); });
  const groups = DRP_GROUP_ORDER.filter((g) => grouped[g]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => (
        <div key={g}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>{g}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {grouped[g].map((o) => {
              const on = selSet.has(o.key);
              const isAuto = autoSet.has(o.key);
              const c = on ? "#dc2626" : "var(--border)";
              return (
                <button key={o.key} type="button" onClick={() => onToggle(o.key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 9, border: `1px solid ${c}`, background: on ? "#fef2f2" : "var(--surface)", color: on ? "#dc2626" : "var(--ink-2)", cursor: "pointer", fontFamily: "var(--sans)", textAlign: "left" }}>
                  <CheckBox on={on} danger mini />
                  <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontSize: 13, fontWeight: on ? 700 : 600 }}>{o.en}</span>
                    <span style={{ fontSize: 10.5, color: "var(--ink-2)", fontWeight: 400 }}>{o.th}</span>
                  </span>
                  {isAuto && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "var(--brand)", color: "#fff", marginLeft: 2 }}>AUTO</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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

/* ---------- HerbOtcSection ---------- */
const HERB_TYPE_INFO = {
  herb:        { label: "สมุนไพร",   emoji: "🌿", bg: "#f0fdf4", border: "#86efac", color: "#166534" },
  supplement:  { label: "อาหารเสริม", emoji: "💊", bg: "#eff6ff", border: "#93c5fd", color: "#1e3a8a" },
  otc:         { label: "ยา OTC",    emoji: "🏪", bg: "#fefce8", border: "#fde047", color: "#713f12" },
};
const HERB_FLAG_INFO = {
  nephrotoxic: { emoji: "🔴", label: "Nephrotoxic" },
  k:           { emoji: "🟠", label: "K⁺ สูง" },
  bleeding:    { emoji: "🔵", label: "เลือดออก" },
  renal:       { emoji: "⚠️", label: "ไตเสื่อม" },
  contra:      { emoji: "⛔", label: "ห้ามใช้" },
  bp:          { emoji: "💊", label: "BP" },
  glucose:     { emoji: "🩸", label: "น้ำตาล" },
};

// HerbDoseHint — inline overdose/AVOID warning for supplements with known max
function HerbDoseHint({ name, dose }) {
  const hd = (typeof window.maxDailyHerbFor === "function") ? window.maxDailyHerbFor(name) : null;
  if (!hd) return null;
  const numM = String(dose || "").match(/(\d+(?:\.\d+)?)/);
  const amt = numM ? parseFloat(numM[1]) : NaN;
  const freqM = String(dose || "").match(/[xX×]\s*(\d+(?:\.\d+)?)/);
  const fr = freqM ? parseFloat(freqM[1]) : 1;
  const daily = isNaN(amt) ? NaN : amt * fr;
  const avoid = hd.maxDaily === 0;
  const over = !avoid && !isNaN(daily) && daily > hd.maxDaily + 0.001;
  if (!avoid && !over) {
    if (hd.maxDaily > 0) return <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--ink-2)" }}>สูงสุด {hd.maxDaily} {hd.unit}/วัน</div>;
    return null;
  }
  return (
    <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#b91c1c", lineHeight: 1.4 }}>
      ⚠️ {avoid ? "ควรหลีกเลี่ยงใน CKD" : `เกินขนาดสูงสุด (${hd.maxDaily} ${hd.unit}/วัน)`}
    </div>
  );
}

function HerbOtcSection({ items, onChange }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [expandedNotes, setExpandedNotes] = React.useState({});

  React.useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); return; }
    const db = (window.HERB_DB || []);
    setResults(db.filter((h) => h.name?.toLowerCase().includes(q) || h.nameEn?.toLowerCase().includes(q)).slice(0, 10));
  }, [query]);

  function addItem(item) {
    if (items.some((x) => x.name === item.name)) { setQuery(""); setResults([]); return; }
    onChange([...items, { name: item.name, type: item.type || "herb", ckdNote: item.ckdNote || "", flags: item.flags || [], custom: false }]);
    setQuery(""); setResults([]);
  }

  function addCustom() {
    if (!customName.trim()) return;
    if (items.some((x) => x.name === customName.trim())) { setShowCustom(false); setCustomName(""); return; }
    onChange([...items, { name: customName.trim(), type: "otc", ckdNote: "", flags: [], custom: true }]);
    setShowCustom(false); setCustomName("");
  }

  function removeItem(name) { onChange(items.filter((x) => x.name !== name)); }
  function toggleNote(name) { setExpandedNotes((p) => ({ ...p, [name]: !p[name] })); }
  function setItemDose(name, dose) { onChange(items.map((x) => x.name === name ? { ...x, dose } : x)); }

  return (
    <div style={{ marginTop: 14 }}>
      <MiniLabel>สมุนไพร / ยา OTC / อาหารเสริม</MiniLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input style={inS} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสมุนไพร, ยา OTC, อาหารเสริม..." />
          {results.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9000, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden" }}>
              {results.map((h) => {
                const ti = HERB_TYPE_INFO[h.type] || HERB_TYPE_INFO.herb;
                const alreadyAdded = items.some((x) => x.name === h.name);
                return (
                  <div key={h.name} onMouseDown={() => !alreadyAdded && addItem(h)}
                    style={{ padding: "9px 12px", cursor: alreadyAdded ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", opacity: alreadyAdded ? 0.5 : 1, background: alreadyAdded ? "var(--surface-2)" : "var(--surface)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", flex: 1 }}>{ti.emoji} {h.name}{h.nameEn ? <span style={{ color: "var(--ink-2)", fontWeight: 400, fontSize: 12 }}> · {h.nameEn}</span> : null}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: ti.bg, color: ti.color, border: `1px solid ${ti.border}` }}>{ti.label}</span>
                    {(h.flags || []).map((fl) => HERB_FLAG_INFO[fl] ? <span key={fl} title={HERB_FLAG_INFO[fl].label} style={{ fontSize: 12 }}>{HERB_FLAG_INFO[fl].emoji}</span> : null)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowCustom((o) => !o)}
          style={{ ...ghostBtn, fontSize: 12.5, padding: "9px 12px", borderStyle: "dashed", whiteSpace: "nowrap" }}>
          + เพิ่มรายการเอง
        </button>
      </div>
      {showCustom && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input style={{ ...inS, flex: 1 }} value={customName} onChange={(e) => setCustomName(e.target.value)}
            placeholder="ระบุชื่อสมุนไพร/ยา/อาหารเสริม..."
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") { setShowCustom(false); setCustomName(""); }}} />
          <button type="button" onClick={addCustom} style={{ ...ghostBtn, color: "var(--brand-deep)", borderColor: "var(--brand)", fontSize: 13 }}>เพิ่ม</button>
          <button type="button" onClick={() => { setShowCustom(false); setCustomName(""); }} style={{ border: "none", background: "none", cursor: "pointer", padding: "0 6px" }}><Icon name="x" size={16} color="var(--ink-2)" /></button>
        </div>
      )}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((item) => {
            const ti = HERB_TYPE_INFO[item.type] || HERB_TYPE_INFO.herb;
            const noteOpen = expandedNotes[item.name];
            return (
              <div key={item.name} style={{ border: `1px solid ${ti.border}`, borderRadius: 10, background: ti.bg, padding: "8px 10px", width: 300 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "rgba(255,255,255,.6)", color: ti.color }}>{ti.emoji} {ti.label}</span>
                  {item.custom && <span style={{ fontSize: 10, color: "var(--ink-2)", fontStyle: "italic" }}>custom</span>}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.name}</span>
                  {(item.flags || []).map((fl) => HERB_FLAG_INFO[fl] ? <span key={fl} title={HERB_FLAG_INFO[fl].label} style={{ fontSize: 13 }}>{HERB_FLAG_INFO[fl].emoji}</span> : null)}
                  {item.ckdNote && (
                    <button type="button" onClick={() => toggleNote(item.name)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: ti.color, fontSize: 11, fontWeight: 700, padding: "0 2px" }}>
                      {noteOpen ? "▲" : "ℹ️"}
                    </button>
                  )}
                  <button type="button" onClick={() => removeItem(item.name)} style={{ border: "none", background: "none", cursor: "pointer", padding: "0 2px" }}><Icon name="x" size={14} color={ti.color} /></button>
                </div>
                {/* amount / วิธีกิน + overdose check */}
                <div style={{ marginTop: 7 }}>
                  <input value={item.dose || ""} onChange={(e) => setItemDose(item.name, e.target.value)}
                    placeholder="ปริมาณ/วิธีกิน เช่น 1000 mg x2, 1 แก้ว/วัน…"
                    style={{ width: "100%", padding: "6px 9px", border: `1px solid ${ti.border}`, borderRadius: 7, fontSize: 12, fontFamily: "var(--sans)", background: "rgba(255,255,255,.7)", color: "var(--ink)", outline: "none", boxSizing: "border-box" }} />
                  <HerbDoseHint name={item.name} dose={item.dose} />
                </div>
                {noteOpen && item.ckdNote && (
                  <div style={{ marginTop: 6, fontSize: 12, color: ti.color, lineHeight: 1.45, paddingTop: 6, borderTop: `1px solid ${ti.border}` }}>{item.ckdNote}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- DrpAnalysisPanel ---------- */
function DrpAnalysisPanel({ meds, otcItems, egfr, k, ckdStage, hb, hco3, phos, ca, bpSys, bpDia, uacr, dm, age, followUp, allergy, acks = {}, user, counselingNote, unackedHigh = [], onAck, onCounsel }) {
  const [open, setOpen] = React.useState(true);
  const fidOf = (fd, i) => fd.id || ("f_" + i + "_" + (fd.msg || "").slice(0, 24));

  const findings = React.useMemo(() => {
    try {
      if (typeof window.analyzeDRPs !== "function") return [];
      const res = window.analyzeDRPs({ meds, otcItems, egfr, k, ckdStage, hb, hco3, phos, ca, bpSys, bpDia, uacr, dm, age, followUp, allergy });
      return (res && Array.isArray(res.findings)) ? res.findings : [];
    } catch (e) { return []; }
  }, [meds, otcItems, egfr, k, ckdStage, hb, hco3, phos, ca, bpSys, bpDia, uacr, dm, age, followUp, allergy]);

  const drugCount = (meds || []).filter((m) => m.drug && m.drug.trim()).length;
  const itemCount = drugCount + (otcItems || []).length;

  const counts = {
    HIGH: findings.filter((f) => f.sev === "HIGH").length,
    MEDIUM: findings.filter((f) => f.sev === "MEDIUM").length,
    LOW: findings.filter((f) => f.sev === "LOW").length,
  };

  // Clean state — reassure the pharmacist (only when there are items to analyse)
  if (!findings.length) {
    if (itemCount === 0) return null;
    return (
      <div style={{ marginBottom: 14, border: "1px solid #86efac", borderRadius: 14, background: "#f0fdf4", padding: "13px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "#166534" }}>ตรวจวิเคราะห์อัตโนมัติแล้ว — ไม่พบปัญหาด้านยา (DRP)</span>
        <span style={{ fontSize: 11.5, color: "#15803d" }}>ตรวจ {itemCount} รายการ</span>
      </div>
    );
  }

  const highestSev = counts.HIGH ? "HIGH" : counts.MEDIUM ? "MEDIUM" : "LOW";
  const sevColor = { HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#2563eb" }[highestSev];
  const sevBg    = { HIGH: "#fef2f2", MEDIUM: "#fffbeb", LOW: "#eff6ff" }[highestSev];

  const SEV_ICON = { HIGH: "⚠️", MEDIUM: "!", LOW: "ℹ️" };
  const SEV_ORDER = ["HIGH", "MEDIUM", "LOW"];
  const SEV_GROUP_LABEL = { HIGH: "ความเสี่ยงสูง", MEDIUM: "ระวัง", LOW: "แจ้งเตือน" };

  return (
    <div style={{ marginBottom: 14, border: `1.5px solid ${sevColor}`, borderRadius: 14, overflow: "hidden", background: sevBg, boxShadow: `0 4px 18px ${sevColor}22` }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
        <span className={highestSev === "HIGH" ? "risk-high-pulse" : ""} style={{ fontSize: 16, width: 30, height: 30, borderRadius: "50%", background: sevColor, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>🔍</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: sevColor }}>ผลวิเคราะห์ปัญหาด้านยา (DRP) อัตโนมัติ</span>
          <span style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {counts.HIGH > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#dc2626", color: "#fff" }}>สูง {counts.HIGH}</span>}
            {counts.MEDIUM > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#d97706", color: "#fff" }}>กลาง {counts.MEDIUM}</span>}
            {counts.LOW > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#2563eb", color: "#fff" }}>ต่ำ {counts.LOW}</span>}
          </span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sevColor, color: "#fff", flexShrink: 0 }}>{findings.length} รายการ</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: sevColor, flexShrink: 0 }}><Icon name="chevron" size={18} /></span>
      </button>
      {/* TASK 1: block-save warning for unacknowledged HIGH findings */}
      {open && unackedHigh.length > 0 && (
        <div style={{ margin: "0 18px 12px", padding: "10px 13px", background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          ⛔ ต้องกด "รับทราบ" ปัญหาความเสี่ยงสูง {unackedHigh.length} รายการก่อนจึงจะบันทึกได้
        </div>
      )}
      {open && (
        <div style={{ padding: "0 18px 14px" }}>
          {/* grouped by severity */}
          {SEV_ORDER.map((sev) => {
            const group = findings.filter((fd) => fd.sev === sev);
            if (!group.length) return null;
            const sc = { HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#2563eb" }[sev];
            return (
              <div key={sev} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: sc, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>{SEV_ICON[sev]} {SEV_GROUP_LABEL[sev]} ({group.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.map((fd) => {
                    const i = findings.indexOf(fd);
                    const label = { HIGH: "สูง", MEDIUM: "กลาง", LOW: "ต่ำ" }[fd.sev] || fd.sev;
                    const fid = fidOf(fd, i);
                    const ack = acks[fid];
                    return (
                      <div key={i} style={{ border: `1px solid ${ack ? "#86efac" : sc + "30"}`, borderRadius: 10, padding: "10px 13px", background: ack ? "#f0fdf4" : "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 12, padding: "2px 7px", borderRadius: 5, background: sc + "18", color: sc, flexShrink: 0, marginTop: 1 }}>{SEV_ICON[fd.sev]} {label}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>{fd.msg}</div>
                            {fd.rec && <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>→ {fd.rec}</div>}
                            {fd.drpKey && typeof window.drpLabel === "function" && <div style={{ fontSize: 10.5, color: "var(--brand-deep)", marginTop: 4, fontWeight: 600 }}>DRP: {window.drpLabel(fd.drpKey)}</div>}
                            {ack && <div style={{ fontSize: 11, color: "#15803d", marginTop: 5, fontWeight: 600 }}>✓ รับทราบโดย {ack.by} · {ack.at}</div>}
                          </div>
                          {onAck && (
                            <button type="button"
                              onClick={() => onAck(fid, ack ? null : { by: (user && user.name) || "เภสัชกร", at: new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) })}
                              style={{ flexShrink: 0, border: `1px solid ${ack ? "#16a34a" : sc + "60"}`, background: ack ? "#16a34a" : "var(--surface)", color: ack ? "#fff" : sc, borderRadius: 7, fontSize: 11.5, fontWeight: 700, padding: "4px 9px", cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap", marginTop: 1 }}>
                              {ack ? "✓ รับทราบแล้ว" : "รับทราบ"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 10, paddingTop: 4 }}>
            ℹ️ ปัญหาที่พบจะถูกบันทึกเป็น DRP โดยอัตโนมัติ (ดู/แก้ไขได้ในส่วน "ประเมินความปลอดภัยด้านยา")
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
            {onCounsel && typeof window.generateCounselingNote === "function" && (
              <button type="button"
                onClick={() => { const note = window.generateCounselingNote(findings); if (note) onCounsel(note); }}
                style={{ ...ghostBtn, color: "var(--brand-deep)", borderColor: "var(--brand)", fontSize: 13, padding: "8px 14px" }}>
                📋 สร้างคำแนะนำผู้ป่วยอัตโนมัติ
              </button>
            )}
          </div>
          {onCounsel && counselingNote && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>คำแนะนำผู้ป่วย (แก้ไขได้ · จะถูกบันทึกและพิมพ์ในใบสรุป)</div>
              <textarea value={counselingNote} onChange={(e) => onCounsel(e.target.value)} rows={Math.min(10, (counselingNote.match(/\n/g) || []).length + 2)}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, fontFamily: "var(--sans)", lineHeight: 1.5, color: "var(--ink)", background: "var(--surface)", outline: "none", resize: "vertical" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- RenalDoseCalc — upgraded to CKD-EPI 2021 ---------- */
function RenalDoseCalc({ age, scr, sex, onFill }) {
  const [open, setOpen] = React.useState(false);
  const [calcAge, setCalcAge] = React.useState(age || "");
  const [calcScr, setCalcScr] = React.useState(scr || "");
  const [calcSex, setCalcSex] = React.useState(sex || "male");
  const [weight, setWeight] = React.useState(""); // optional for C-G comparison

  React.useEffect(() => { if (age) setCalcAge(age); }, [age]);
  React.useEffect(() => { if (scr) setCalcScr(scr); }, [scr]);
  React.useEffect(() => { if (sex) setCalcSex(sex); }, [sex]);

  // CKD-EPI 2021
  const ckdepiResult = React.useMemo(() => {
    const v = calcCKDEPI2021(calcScr, calcAge, calcSex);
    if (v === null) return null;
    return { egfr: v, stage: ckdStageFromEgfr(v) };
  }, [calcAge, calcScr, calcSex]);

  // Cockcroft-Gault (optional, needs weight)
  const cgResult = React.useMemo(() => {
    const a = parseFloat(calcAge), w = parseFloat(weight), s = parseFloat(calcScr);
    if (!a || !w || !s || s <= 0) return null;
    const sf = calcSex === "female" ? 0.85 : 1.0;
    return { crcl: Math.round(((140 - a) * w * sf) / (72 * s) * 10) / 10 };
  }, [calcAge, weight, calcScr, calcSex]);

  if (!open) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 1 }}>
        <button type="button" onClick={() => setOpen(true)}
          style={{ ...ghostBtn, fontSize: 12, padding: "7px 11px", color: "var(--brand-deep)", borderColor: "var(--brand)", whiteSpace: "nowrap" }}>
          <Icon name="pill" size={13} />คำนวณ eGFR
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--brand)", borderRadius: 12, padding: 14, background: "var(--brand-soft)", flex: "1 1 300px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-deep)", flex: 1 }}>คำนวณ eGFR (CKD-EPI 2021)</span>
        <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={15} color="var(--ink-2)" /></button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: "1 1 70px" }}>
          <MiniLabel>อายุ (ปี)</MiniLabel>
          <input style={inS} value={calcAge} onChange={(e) => setCalcAge(e.target.value)} inputMode="numeric" placeholder="ปี" />
        </div>
        <div style={{ flex: "1 1 80px" }}>
          <MiniLabel>Scr (mg/dL)</MiniLabel>
          <input style={inS} value={calcScr} onChange={(e) => setCalcScr(e.target.value)} inputMode="decimal" placeholder="mg/dL" />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <MiniLabel>เพศ</MiniLabel>
          <div style={{ display: "flex", gap: 4 }}>
            {[["male", "ชาย"], ["female", "หญิง"]].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setCalcSex(v)}
                style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${calcSex === v ? "var(--brand)" : "var(--border)"}`, background: calcSex === v ? "var(--brand)" : "var(--surface)", color: calcSex === v ? "#fff" : "var(--ink-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: "1 1 80px" }}>
          <MiniLabel>น้ำหนัก (kg) <span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 10 }}>C-G only</span></MiniLabel>
          <input style={inS} value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="ไม่จำเป็น" />
        </div>
      </div>

      {ckdepiResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", borderRadius: 9, border: "1px solid var(--brand)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand-deep)", textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>CKD-EPI 2021</div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-deep)", fontFamily: "var(--mono)" }}>{ckdepiResult.egfr} mL/min/1.73m²</span>
              <span style={{ marginLeft: 10, fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>→ CKD {ckdepiResult.stage}</span>
            </div>
            <button type="button" onClick={() => { onFill(String(ckdepiResult.egfr)); setOpen(false); }}
              style={{ ...ghostBtn, color: "var(--brand-deep)", borderColor: "var(--brand)", fontSize: 12.5, padding: "7px 12px" }}>
              ใส่ค่า eGFR
            </button>
          </div>
          {cgResult && (
            <div style={{ padding: "8px 12px", background: "var(--surface)", borderRadius: 9, border: "1px solid var(--border)", fontSize: 12, color: "var(--ink-2)" }}>
              Cockcroft-Gault (CrCl): <span style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--ink)" }}>{cgResult.crcl} mL/min</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--ink-2)", padding: "8px 0" }}>กรอก Scr, อายุ และเพศเพื่อคำนวณ CKD-EPI 2021</div>
      )}
    </div>
  );
}

/* ---------- LabSparkline moved to lab_trend.jsx (upgraded to multi-series) ---------- */

/* ---------- Feature 4: DRP Summary Card ---------- */
function DrpSummaryCard({ meds, otcItems, egfr }) {
  const [open, setOpen] = React.useState(true);

  const allIssues = React.useMemo(() => {
    const issues = [];
    const drugList = (meds || []).filter(m => m.drug && m.drug.trim());

    // DDI
    if (typeof window.checkDDI === "function" && drugList.length >= 2) {
      const ddis = window.checkDDI(drugList.map(m => ({ name: m.drug })));
      ddis.forEach(d => issues.push({
        type: "ddi",
        level: d.severity === "major" ? "major" : d.severity === "moderate" ? "moderate" : "minor",
        text: `DDI: ${d.drugA} + ${d.drugB}`,
        detail: d.message,
      }));
    }

    // Dose adjustment + Contraindication per drug
    if (egfr) {
      drugList.forEach(m => {
        if (typeof window.checkContraindicated === "function") {
          const c = window.checkContraindicated(m.drug, egfr);
          if (c) issues.push({
            type: "contra",
            level: c.level === "contraindicated" ? "major" : "moderate",
            text: c.level === "contraindicated" ? `ห้ามใช้: ${m.drug}` : `ระวัง: ${m.drug}`,
            detail: c.message,
          });
        }
        if (typeof window.checkDoseAdjustment === "function") {
          const d = window.checkDoseAdjustment(m.drug, egfr);
          if (d) issues.push({
            type: "dose",
            level: d.level === "avoid" ? "major" : "moderate",
            text: `ปรับขนาด: ${m.drug}`,
            detail: d.message,
          });
        }
      });
    }

    return issues;
  }, [meds, otcItems, egfr]);

  const counts = {
    major: allIssues.filter(i => i.level === "major").length,
    moderate: allIssues.filter(i => i.level === "moderate").length,
    minor: allIssues.filter(i => i.level === "minor").length,
  };
  const total = allIssues.length;

  if ((meds || []).filter(m => m.drug).length === 0) return null;

  const iconOf = l => l === "major" ? "🔴" : l === "moderate" ? "🟡" : "🟢";
  const colorOf = l => l === "major" ? "#b91c1c" : l === "moderate" ? "#92400e" : "#166534";
  const bgOf = l => l === "major" ? "#fef2f2" : l === "moderate" ? "#fffbeb" : "#f0fdf4";

  return (
    <div style={{ marginTop: 14, border: `1.5px solid ${total ? "#fcd34d" : "#86efac"}`, borderRadius: 14, background: total ? "#fffbeb" : "#f0fdf4", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{total ? "⚠️" : "✅"}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: total ? "#92400e" : "#166534" }}>สรุป DRP ที่ตรวจพบ</span>
          {total > 0 ? (
            <span style={{ display: "flex", gap: 6, marginTop: 3 }}>
              {counts.major > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#dc2626", color: "#fff" }}>🔴 Major {counts.major}</span>}
              {counts.moderate > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#d97706", color: "#fff" }}>🟡 Moderate {counts.moderate}</span>}
              {counts.minor > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#16a34a", color: "#fff" }}>🟢 Minor {counts.minor}</span>}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#166534" }}>ไม่พบ DRP</span>
          )}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: total ? "#d97706" : "#16a34a", color: "#fff", flexShrink: 0 }}>{total} รายการ</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: total ? "#92400e" : "#166534", flexShrink: 0 }}><Icon name="chevron" size={18} /></span>
      </button>
      {open && total > 0 && (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {allIssues.map((issue, i) => (
            <div key={i} style={{ padding: "9px 12px", borderRadius: 9, background: bgOf(issue.level), border: `1px solid ${colorOf(issue.level)}30` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colorOf(issue.level) }}>{iconOf(issue.level)} {issue.text}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>{issue.detail}</div>
            </div>
          ))}
        </div>
      )}
      {open && total === 0 && (
        <div style={{ padding: "10px 18px 14px", fontSize: 13.5, color: "#166534", fontWeight: 600 }}>✅ ไม่พบ DRP จากรายการยาที่กรอก</div>
      )}
    </div>
  );
}

Object.assign(window, { BpmlForm });
