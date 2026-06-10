/* =========================================================================
   data.jsx — โมเดลข้อมูล, เครื่องมือประเมินความเสี่ยง, store
   หมายเหตุ: DRUG_DB, FLAG_LABEL, lookupDrug ย้ายไป app/drug_db.jsx แล้ว
   ========================================================================= */


function lookupDrug(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return DRUG_DB.find((d) => d.name.toLowerCase() === n) ||
         DRUG_DB.find((d) => d.name.toLowerCase().startsWith(n)) || null;
}

/* ---------- 2. ตัวเลือก checkbox ตามแบบฟอร์ม BPML ---------- */
const SOURCE_OPTIONS = [
  { key: "record", th: "เวชระเบียน", en: "Medical record" },
  { key: "prev_rx", th: "ใบสั่งยาครั้งก่อน", en: "Previous prescription" },
  { key: "brought", th: "ยาที่ผู้ป่วยนำมา", en: "Medicines brought" },
  { key: "interview", th: "สัมภาษณ์ผู้ป่วย/ญาติ", en: "Patient/family interview" },
  { key: "other_clinic", th: "คลินิก/ร้านยาอื่น", en: "Other clinics/pharmacies" },
];

/* ---------- DRP taxonomy — PCNE Classification v9.1 (DRP problem domains) ----------
   key เป็นชุดใหม่ (ไม่ backward-compat) ; group = PCNE domain
   en = primary English label, th = Thai gloss */
const DRP_OPTIONS = [
  /* INDICATION */
  { key: "untreated_indication", en: "Untreated indication", th: "ข้อบ่งใช้ที่ยังไม่ได้รักษา", group: "Indication" },
  { key: "no_indication", en: "Drug without indication", th: "ใช้ยาโดยไม่มีข้อบ่งชี้", group: "Indication" },
  { key: "duplicate", en: "Therapeutic duplication", th: "ยาซ้ำซ้อน", group: "Indication" },
  { key: "needs_additional", en: "Additional therapy required", th: "ต้องการยาเสริม", group: "Indication" },

  /* EFFECTIVENESS */
  { key: "subtherapeutic_dose", en: "Dose too low", th: "ขนาดยาต่ำเกินไป", group: "Effectiveness" },
  { key: "ineffective_drug", en: "Ineffective / inappropriate drug", th: "เลือกยาไม่เหมาะสม", group: "Effectiveness" },

  /* SAFETY */
  { key: "supratherapeutic_dose", en: "Dose too high", th: "ขนาดยาสูงเกินไป", group: "Safety" },
  { key: "renal_dose", en: "Renal dose adjustment needed", th: "ต้องปรับขนาดตามการทำงานของไต", group: "Safety" },
  { key: "adr", en: "Adverse drug reaction", th: "อาการไม่พึงประสงค์", group: "Safety" },
  { key: "ddi", en: "Drug–drug interaction", th: "อันตรกิริยาระหว่างยา", group: "Safety" },
  { key: "contraindication", en: "Contraindication", th: "ข้อห้ามใช้", group: "Safety" },
  { key: "nephrotoxic", en: "Nephrotoxic drug", th: "ยาที่เป็นพิษต่อไต", group: "Safety" },
  { key: "allergy", en: "Drug allergy / cross-sensitivity", th: "แพ้ยา/ข้ามกลุ่ม", group: "Safety" },
  { key: "electrolyte", en: "Electrolyte abnormality", th: "ความผิดปกติเกลือแร่", group: "Safety" },

  /* MONITORING */
  { key: "monitoring", en: "Monitoring required", th: "ต้องติดตาม/ตรวจแล็บ", group: "Monitoring" },

  /* PROCESS / USE */
  { key: "adherence", en: "Adherence problem", th: "ปัญหาความร่วมมือใช้ยา", group: "Process / Use" },
  { key: "administration", en: "Improper administration/technique", th: "วิธีใช้/เทคนิคไม่ถูกต้อง", group: "Process / Use" },
  { key: "timing", en: "Inappropriate timing/spacing", th: "เวลา/ระยะห่างไม่เหมาะสม", group: "Process / Use" },
  { key: "formulation", en: "Inappropriate formulation", th: "รูปแบบยาไม่เหมาะสม", group: "Process / Use" },
  { key: "reconciliation", en: "Medication discrepancy", th: "ความคลาดเคลื่อนรายการยา", group: "Process / Use" },
];

// drpOption(key) → option object | null ; drpLabel(key) → "English (ไทย)"
function drpOption(key) { return DRP_OPTIONS.find((o) => o.key === key) || null; }
function drpLabel(key) {
  const o = drpOption(key);
  if (!o) return key || "";
  return `${o.en} (${o.th})`;
}

const INTERVENTION_OPTIONS = [
  { key: "inform", th: "แจ้งแพทย์", en: "Inform physician" },
  { key: "adjust", th: "ปรับยา", en: "Adjust medication" },
  { key: "counsel", th: "ให้คำปรึกษาผู้ป่วย", en: "Patient counseling" },
];

const CKD_STAGES = ["1", "2", "3a", "3b", "4", "5"];

/* ---------- 3. เครื่องมือประเมินความเสี่ยง (Risk engine) ---------- */
function computeRisk(r) {
  const f = [];
  let s = 0;
  const eg = Number(r.egfr);
  const k = Number(r.k);

  // CKD stage / eGFR
  if (r.ckdStage === "5" || (eg && eg < 15)) { s += 3; f.push({ t: "CKD ระยะ 5 / eGFR < 15", w: 3 }); }
  else if (r.ckdStage === "4" || (eg && eg < 30)) { s += 2; f.push({ t: "CKD ระยะ 4 / eGFR < 30", w: 2 }); }
  else if (r.ckdStage === "3b" || (eg && eg < 45)) { s += 1; f.push({ t: "CKD ระยะ 3b", w: 1 }); }

  // โพแทสเซียมผิดปกติ
  if (k && (k > 5.5 || k < 3.0)) { s += 2; f.push({ t: `K⁺ ผิดปกติ (${k})`, w: 2 }); }
  else if (k && (k > 5.0 || k < 3.5)) { s += 1; f.push({ t: `K⁺ เฝ้าระวัง (${k})`, w: 1 }); }

  // DRP
  const drps = r.drps || [];
  if (drps.includes("contraindication")) { s += 3; f.push({ t: "มียาที่ห้ามใช้ใน CKD", w: 3 }); }
  if (drps.includes("nephrotoxic")) { s += 2; f.push({ t: "ใช้ยา Nephrotoxic", w: 2 }); }
  if (drps.includes("electrolyte")) { s += 1; f.push({ t: "เสี่ยงเกลือแร่ผิดปกติ", w: 1 }); }
  if (drps.includes("adherence")) { s += 1; f.push({ t: "ปัญหาการกินยา", w: 1 }); }
  if (drps.includes("supratherapeutic_dose")) { s += 2; f.push({ t: "ขนาดยารวมเกินขนาด", w: 2 }); }
  const otherDrp = drps.filter((d) => !["contraindication", "nephrotoxic", "electrolyte", "adherence", "supratherapeutic_dose"].includes(d)).length;
  if (otherDrp >= 2) { s += 2; f.push({ t: `พบ DRP ${drps.length} ข้อ`, w: 2 }); }
  else if (otherDrp === 1) { s += 1; f.push({ t: "พบ DRP", w: 1 }); }

  // ความคลาดเคลื่อนที่ยังไม่ได้แก้
  if (r.discrepancy === "found" && r.outcome !== "accepted") {
    s += 3; f.push({ t: "Discrepancy ยังไม่ได้แก้ไข", w: 3 });
  }

  // flag จากยาในรายการ (เผื่อยังไม่ติ๊ก DRP)
  const medFlags = new Set();
  (r.meds || []).forEach((m) => (m.flags || []).forEach((x) => medFlags.add(x)));
  if (medFlags.has("contra") && !drps.includes("contraindication")) { s += 2; f.push({ t: "ตรวจพบยากลุ่มห้ามใช้", w: 2 }); }
  if (medFlags.has("nephrotoxic") && !drps.includes("nephrotoxic")) { s += 1; f.push({ t: "ตรวจพบยา Nephrotoxic", w: 1 }); }

  let band = "low";
  if (s >= 6) band = "high";
  else if (s >= 3) band = "medium";
  return { score: s, band, factors: f };
}

const RISK_META = {
  high: { th: "เสี่ยงสูง", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  medium: { th: "เสี่ยงปานกลาง", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  low: { th: "เสี่ยงต่ำ", color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
};

/* ---------- 4. Store (localStorage วันนี้ → Firebase ภายหลัง) ----------
   เปลี่ยนไปใช้ Firebase: แทนที่ read/write ด้านล่างด้วย Firestore SDK
   (onSnapshot สำหรับ realtime sync, setDoc สำหรับบันทึก). โครงสร้าง record คงเดิม
*/
const LS_KEY = "pharm_ckd_records_v1";
const Store = {
  all() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") || []; }
    catch (e) { return []; }
  },
  _persist(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); },
  save(rec) {
    const list = this.all();
    const now = new Date().toISOString();
    if (rec.id) {
      const i = list.findIndex((x) => x.id === rec.id);
      rec.updatedAt = now;
      if (i >= 0) list[i] = rec; else list.push(rec);
    } else {
      rec.id = "r" + Date.now();
      rec.createdAt = now; rec.updatedAt = now;
      list.push(rec);
    }
    this._persist(list);
    return rec;
  },
  remove(id) { this._persist(this.all().filter((x) => x.id !== id)); },
  reset() { localStorage.removeItem(LS_KEY); },
};

/* ---------- 5. ผู้ใช้ — จัดการผ่าน Firestore เท่านั้น ---------- */
const USERS = [];


const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function fmtDate(s) { if (!s) return "–"; const d = new Date(s); if (isNaN(d)) return s; return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; }

/* ── Date helpers — แหล่งเดียวสำหรับ "วันนี้" ทั้งระบบ (แทนวันที่ hardcode) ── */
function todayDate() { return new Date(); }                                   // Date object ของวันนี้จริง
function todayISO() { const d = new Date(); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10); } // "YYYY-MM-DD" ตามเวลาท้องถิ่น
function isoAddDays(n) { const d = new Date(); d.setDate(d.getDate() + n); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10); } // วันนี้ + n วัน
function monthStartISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; } // วันแรกของเดือนนี้

Object.assign(window, {
  SOURCE_OPTIONS, DRP_OPTIONS, drpOption, drpLabel, INTERVENTION_OPTIONS,
  CKD_STAGES, computeRisk, RISK_META, Store, USERS,
  TH_MONTHS, fmtDate, todayDate, todayISO, isoAddDays, monthStartISO,
});
