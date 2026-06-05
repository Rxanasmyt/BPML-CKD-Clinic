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

const DRP_OPTIONS = [
  { key: "duplicate", th: "ยาซ้ำ", en: "Duplicate drug" },
  { key: "omission", th: "ยาขาด/ยาหาย", en: "Omission" },
  { key: "renal_dose", th: "ขนาดยาไม่เหมาะกับไต", en: "Inappropriate renal dose" },
  { key: "contra", th: "ข้อห้ามใช้ใน CKD", en: "Contraindicated in CKD" },
  { key: "nephrotoxic", th: "Nephrotoxic drug", en: "Nephrotoxic drug" },
  { key: "electrolyte", th: "เสี่ยงเกลือแร่ผิดปกติ", en: "Electrolyte-related risk" },
  { key: "ddi", th: "Drug–drug interaction", en: "Drug–drug interaction" },
  { key: "adherence", th: "ปัญหาการกินยา", en: "Adherence problem" },
  { key: "overdose", th: "ขนาดรวมเกินขนาด", en: "Dose exceeds maximum" },
];

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
  if (drps.includes("contra")) { s += 3; f.push({ t: "มียาที่ห้ามใช้ใน CKD", w: 3 }); }
  if (drps.includes("nephrotoxic")) { s += 2; f.push({ t: "ใช้ยา Nephrotoxic", w: 2 }); }
  if (drps.includes("electrolyte")) { s += 1; f.push({ t: "เสี่ยงเกลือแร่ผิดปกติ", w: 1 }); }
  if (drps.includes("adherence")) { s += 1; f.push({ t: "ปัญหาการกินยา", w: 1 }); }
  if (drps.includes("overdose")) { s += 2; f.push({ t: "ขนาดยารวมเกินขนาด", w: 2 }); }
  const otherDrp = drps.filter((d) => !["contra", "nephrotoxic", "electrolyte", "adherence", "overdose"].includes(d)).length;
  if (otherDrp >= 2) { s += 2; f.push({ t: `พบ DRP ${drps.length} ข้อ`, w: 2 }); }
  else if (otherDrp === 1) { s += 1; f.push({ t: "พบ DRP", w: 1 }); }

  // ความคลาดเคลื่อนที่ยังไม่ได้แก้
  if (r.discrepancy === "found" && r.outcome !== "accepted") {
    s += 3; f.push({ t: "Discrepancy ยังไม่ได้แก้ไข", w: 3 });
  }

  // flag จากยาในรายการ (เผื่อยังไม่ติ๊ก DRP)
  const medFlags = new Set();
  (r.meds || []).forEach((m) => (m.flags || []).forEach((x) => medFlags.add(x)));
  if (medFlags.has("contra") && !drps.includes("contra")) { s += 2; f.push({ t: "ตรวจพบยากลุ่มห้ามใช้", w: 2 }); }
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

Object.assign(window, {
  SOURCE_OPTIONS, DRP_OPTIONS, INTERVENTION_OPTIONS,
  CKD_STAGES, computeRisk, RISK_META, Store, USERS,
  TH_MONTHS, fmtDate,
});
