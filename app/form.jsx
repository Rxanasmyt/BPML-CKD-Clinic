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

function FormProgress({ active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'var(--surface)', borderRadius: 12,
      padding: '10px 16px', marginBottom: 20,
      border: '1px solid var(--border)',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      overflowX: 'auto',
    }}>
      {FORM_STEPS.map((s, i) => {
        const done = parseInt(active) > parseInt(s.n);
        const cur  = active === s.n;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: done ? 'var(--brand)' : cur ? 'var(--brand)' : 'var(--surface-2)',
                border: `2px solid ${cur||done ? 'var(--brand)' : 'var(--border)'}`,
                display: 'grid', placeItems: 'center',
                color: cur||done ? '#fff' : 'var(--ink-2)',
                fontSize: 11, fontWeight: 700,
                transition: 'all 0.2s',
              }}>
                {done ? '✓' : s.n}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: cur ? 700 : 500, color: cur ? 'var(--brand)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < FORM_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, minWidth: 16, background: done ? 'var(--brand)' : 'var(--border)', margin: '0 4px', marginBottom: 16, transition: 'background 0.3s' }} />
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
function blankMed() { return { drug: "", strength: "", dose: "", actuallyTaking: "", source: "", remark: "", flags: [] }; }

function BpmlForm({ initial, user, records = [], onSave, onCancel }) {
  const [f, setF] = React.useState(() => initial ? JSON.parse(JSON.stringify(initial)) : {
    hn: "", name: "", age: "", sex: "male", ckdStage: "", date: "2026-05-29", scr: "", egfr: "", k: "", na: "",
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
  const [hnSuggest, setHnSuggest] = React.useState(null);

  // Feature 2: track whether eGFR was manually overridden
  const [egfrManual, setEgfrManual] = React.useState(false);
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

  // Feature 3: copy meds modal state
  const [copyModalVisit, setCopyModalVisit] = React.useState(null);
  const [copySelection, setCopySelection] = React.useState({});

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

  // Feature 3: open copy modal
  function openCopyModal(visit) {
    const meds = visit.meds || [];
    const sel = {};
    meds.forEach((_, idx) => { sel[idx] = true; });
    setCopyModalVisit(visit);
    setCopySelection(sel);
  }

  function applyCopySelection() {
    if (!copyModalVisit) return;
    const meds = (copyModalVisit.meds || []).filter((_, idx) => copySelection[idx]);
    if (meds.length) setF((p) => ({ ...p, meds: meds.map((m) => ({ ...m })) }));
    setCopyModalVisit(null);
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

      {/* Feature 3: Copy Meds Modal */}
      {copyModalVisit && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setCopyModalVisit(null); }}
        >
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", width: "min(560px, 96vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>เลือกยาที่ต้องการคัดลอก</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>จาก visit {fmtDate(copyModalVisit.date)} · {(copyModalVisit.meds || []).length} รายการ</div>
              </div>
              <button type="button" onClick={() => setCopyModalVisit(null)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Icon name="x" size={18} color="var(--ink-2)" /></button>
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
          action={<button onClick={onCancel} style={ghostBtn}><Icon name="x" size={16} />ยกเลิก</button>}
        />

        <FormProgress active={activeStep} />

        {/* ส่วนที่ 1 */}
        <div ref={el => sectionRefs.current['1'] = el}>
        <FSection n="1" title="ข้อมูลผู้ป่วย" en="Patient Information" defaultOpen lockOpen>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,160px) 1fr 90px", gap: 12, alignItems: "start" }} className="pinfo-row">
            <FloatInput label="HN" value={f.hn} onChange={(e) => onHnChange(e.target.value)} placeholder="66xxxxx" />
            <FloatInput label="ชื่อ-สกุล" value={f.name} onChange={(e) => set("name", e.target.value)} />
            <FloatInput label="อายุ" unit="ปี" value={f.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" />
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CKD_STAGES.map((s) => (
                  <button key={s} type="button" onClick={() => set("ckdStage", s)}
                    style={{ flex: "1 1 60px", maxWidth: 110, padding: "10px 0", border: `1px solid ${f.ckdStage === s ? "var(--brand)" : "var(--border)"}`, background: f.ckdStage === s ? "var(--brand)" : "var(--surface)", color: f.ckdStage === s ? "#fff" : "var(--ink-2)", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" }}>{s}</button>
                ))}
              </div>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {f.meds.map((m, i) => (
              <MedRow
                key={i} i={i} m={m} setMed={setMed} pickDrug={pickDrug}
                del={() => delMed(i)} canDel={f.meds.length > 1}
                allergyConflict={allergyConflicts[i]}
              />
            ))}
          </div>
          <button type="button" onClick={addMed} style={{ ...ghostBtn, marginTop: 12, borderStyle: "dashed", width: "100%", justifyContent: "center" }}>
            <Icon name="plus" size={16} /> เพิ่มรายการยา
          </button>
          <HerbOtcSection items={f.otcItems || []} onChange={(v) => set("otcItems", v)} />
        </FSection>
        </div>{/* /section-2-ref */}

        {/* DRP Auto-analysis panel */}
        <DrpAnalysisPanel meds={f.meds} otcItems={f.otcItems || []} egfr={f.egfr} k={f.k} ckdStage={f.ckdStage}
          onApplyDrps={(keys) => setF((p) => ({ ...p, drps: [...new Set([...(p.drps || []), ...keys])] }))} />

        {/* ส่วนที่ 4 */}
        <div ref={el => sectionRefs.current['4'] = el}>
        <FSection n="4" title="ประเมินความปลอดภัยด้านยาใน CKD" en="CKD Safety Screening" defaultOpen
          badge={f.drps.length ? f.drps.length + " ปัญหา" : null} badgeTone={f.drps.length ? "danger" : null}>
          <ChipGroup options={DRP_OPTIONS} selected={f.drps} onToggle={(k) => toggle("drps", k)} danger />
          {f.drps.length > 0 && (
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

/* ---------- Med row + autosuggest + dose builder ---------- */
function MedRow({ i, m, setMed, pickDrug, del, canDel, allergyConflict }) {
  const [focus, setFocus] = React.useState(false);
  const [expanded, setExpanded] = React.useState(!m.drug);
  const [dropPos, setDropPos] = React.useState(null);
  const drugInputRef = React.useRef(null);

  const matches = focus && m.drug.trim().length >= 1
    ? RecentDrugs.sorted(m.drug.trim())
    : (focus ? RecentDrugs.sorted("") : []);

  const hasConflict = allergyConflict && allergyConflict.conflict;

  function openDrop() {
    if (drugInputRef.current) {
      const r = drugInputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      setDropPos({
        top: spaceBelow > 260 ? r.bottom + 4 : r.top - 4,
        left: r.left,
        width: Math.max(r.width, 420),
        above: spaceBelow <= 260,
      });
    }
    setFocus(true);
  }

  return (
    <div>
      {hasConflict && (
        <div style={{ padding: "8px 12px 8px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderBottom: "none", borderRadius: "10px 10px 0 0", fontSize: 12.5, fontWeight: 600, color: "#b91c1c", display: "flex", alignItems: "center", gap: 7 }}>
          ⚠️ แพ้ยา: {allergyConflict.reason}
        </div>
      )}
      <div style={{
        border: `1px solid ${hasConflict ? "#fca5a5" : "var(--border)"}`,
        borderTop: hasConflict ? "none" : undefined,
        borderLeft: hasConflict ? "4px solid #dc2626" : undefined,
        borderRadius: hasConflict ? "0 0 12px 12px" : 12,
        background: "var(--surface-2)", position: "relative",
        overflow: "hidden",
      }}>
        {/* Collapsed / header bar */}
        {!expanded ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", minHeight: 48 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>{(m.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.drug || <span style={{ color: "var(--ink-2)", fontWeight: 400, fontStyle: "italic" }}>ยังไม่ระบุ</span>}
              {m.strength && <span style={{ fontFamily: "var(--mono)", fontWeight: 400, color: "var(--ink-2)", fontSize: 12, marginLeft: 8 }}>{m.strength}</span>}
              {m.dose && <span style={{ fontFamily: "var(--mono)", fontWeight: 400, color: "var(--ink-2)", fontSize: 12, marginLeft: 8 }}>{m.dose}</span>}
            </span>
            {m.actuallyTaking && m.actuallyTaking !== "ตามสั่ง" && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#fef9c3", color: "#713f12", border: "1px solid #fde047", flexShrink: 0 }}>{m.actuallyTaking}</span>
            )}
            <button type="button" onClick={() => setExpanded(true)}
              style={{ border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", cursor: "pointer", padding: "4px 8px", fontSize: 12, color: "var(--ink-2)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
              ▼ แก้ไข
            </button>
            {canDel && <button type="button" onClick={del} title="ลบ" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-2)", padding: 4, flexShrink: 0 }}><Icon name="x" size={16} /></button>}
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            {/* Expanded header row with collapse button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              {m.drug && (
                <button type="button" onClick={() => setExpanded(false)}
                  style={{ border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", cursor: "pointer", padding: "4px 10px", fontSize: 12, color: "var(--ink-2)" }}>
                  ▲ ยุบ
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 22 }}>{i + 1}</span>

              <div style={{ flex: "2 1 200px", position: "relative" }}>
                <MiniLabel>ชื่อยา / Drug</MiniLabel>
                <input ref={drugInputRef} style={inS} value={m.drug} onChange={(e) => setMed(i, "drug", e.target.value)}
                  onFocus={openDrop} onBlur={() => setTimeout(() => setFocus(false), 180)}
                  placeholder="พิมพ์ชื่อยา..." />
                {focus && matches.length > 0 && dropPos && (
                  <div style={{
                    position: "fixed",
                    top: dropPos.above ? undefined : dropPos.top,
                    bottom: dropPos.above ? (window.innerHeight - dropPos.top) : undefined,
                    left: dropPos.left,
                    width: dropPos.width,
                    maxHeight: 380, overflowY: "auto",
                    zIndex: 9000, background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)",
                  }}>
                    <div style={{ padding: "8px 14px 6px", fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🔍</span>
                      <span>{m.drug.trim() ? "ผลการค้นหา" : "ยาที่ใช้บ่อย"}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 10, color: "var(--ink-2)" }}>{matches.length} รายการ</span>
                    </div>
                    {matches.slice(0, 8).map((d) => (
                      <div key={d.name} onMouseDown={() => { pickDrug(i, d); setExpanded(false); }} className="acrow"
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{d.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 5, background: "var(--brand-soft)", color: "var(--brand-deep)", border: "1px solid var(--brand)30" }}>{d.cls}</span>
                          <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>{(d.flags || []).map((fl) => <FlagDot key={fl} fl={fl} />)}</span>
                        </div>
                        {d.strengths && d.strengths.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: d.note ? 4 : 0 }}>
                            {d.strengths.map((s) => (
                              <span key={s} style={{ fontSize: 11, fontFamily: "var(--mono)", padding: "1px 6px", borderRadius: 5, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-2)" }}>{s}</span>
                            ))}
                          </div>
                        )}
                        {d.note && <div style={{ fontSize: 11, color: (d.flags||[]).includes("contra") || (d.flags||[]).includes("nephrotoxic") ? "#b91c1c" : "var(--ink-2)", lineHeight: 1.4 }}>{d.note}</div>}
                      </div>
                    ))}
                    {matches.length === 0 && (
                      <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-2)", fontStyle: "italic" }}>พิมพ์ชื่อเพิ่มเองได้</div>
                    )}
                    {m.drug.trim() && matches.length < 8 && (
                      <div style={{ padding: "8px 14px", fontSize: 11.5, color: "var(--ink-2)", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>พิมพ์ชื่อเพิ่มเองได้</div>
                    )}
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
        )}
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

  return (
    <div style={{ marginTop: 14 }}>
      <MiniLabel>สมุนไพร / ยา OTC / อาหารเสริม</MiniLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input style={inS} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสมุนไพร, ยา OTC, อาหารเสริม..." />
          {results.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden" }}>
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
              <div key={item.name} style={{ border: `1px solid ${ti.border}`, borderRadius: 10, background: ti.bg, padding: "8px 10px", maxWidth: 280 }}>
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
function DrpAnalysisPanel({ meds, otcItems, egfr, k, ckdStage, onApplyDrps }) {
  const [open, setOpen] = React.useState(true);

  const findings = React.useMemo(() => {
    try {
      if (typeof window.analyzeDRPs !== "function") return [];
      return window.analyzeDRPs({ meds, otcItems, egfr, k, ckdStage }) || [];
    } catch (e) { return []; }
  }, [meds, otcItems, egfr, k, ckdStage]);

  if (!findings.length) return null;

  const highestSev = findings.some((f) => f.severity === "HIGH") ? "HIGH"
    : findings.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : "LOW";
  const sevColor = { HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#2563eb" }[highestSev];
  const sevBg    = { HIGH: "#fef2f2", MEDIUM: "#fffbeb", LOW: "#eff6ff" }[highestSev];

  function applyAll() {
    const keys = [...new Set(findings.flatMap((f) => f.drpKeys || []))];
    if (keys.length) onApplyDrps(keys);
  }

  const SEV_ICON = { HIGH: "⚠️", MEDIUM: "!", LOW: "ℹ️" };

  return (
    <div style={{ marginBottom: 14, border: `1px solid ${sevColor}40`, borderRadius: 14, overflow: "hidden", background: sevBg }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: sevColor }}>ผลวิเคราะห์ DRP อัตโนมัติ</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sevColor, color: "#fff" }}>{findings.length} รายการ</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: sevColor }}><Icon name="chevron" size={18} /></span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {findings.map((fd, i) => {
              const sc = { HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#2563eb" }[fd.severity] || "#64748b";
              return (
                <div key={i} style={{ border: `1px solid ${sc}30`, borderRadius: 10, padding: "10px 13px", background: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, padding: "2px 7px", borderRadius: 5, background: sc + "18", color: sc, flexShrink: 0, marginTop: 1 }}>{SEV_ICON[fd.severity]} {fd.severity}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>{fd.message}</div>
                      {fd.recommendation && <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>→ {fd.recommendation}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={applyAll}
            style={{ marginTop: 12, ...ghostBtn, color: sevColor, borderColor: sevColor + "60", fontSize: 13, padding: "8px 14px" }}>
            นำไปใส่ใน DRP ✓
          </button>
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

Object.assign(window, { BpmlForm });
