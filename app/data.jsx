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
  const otherDrp = drps.filter((d) => !["contra", "nephrotoxic", "electrolyte", "adherence"].includes(d)).length;
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
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") || SEED_RECORDS; }
    catch (e) { return SEED_RECORDS; }
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

/* ---------- 5. ผู้ใช้ (เภสัชกร / แอดมิน) ---------- */
const USERS = [
  { id: "u1", username: "admin", pin: "1234", name: "ภญ. สุนิสา ใจดี", role: "admin", license: "ภ.12345" },
  { id: "u2", username: "pharm1", pin: "1111", name: "ภก. ธนวัฒน์ รักษ์ไต", role: "pharmacist", license: "ภ.23456" },
  { id: "u3", username: "pharm2", pin: "2222", name: "ภญ. ปิยะดา วงศ์ไทย", role: "pharmacist", license: "ภ.34567" },
];

/* ---------- 6. ข้อมูลตัวอย่าง (seed) ---------- */
function mk(o) {
  const rec = Object.assign({
    sources: [], meds: [], drps: [], interventions: [],
    comparedPrev: false, comparedNew: false, discrepancy: "none",
    otcHerbal: false, createdBy: "u2",
  }, o);
  return rec;
}
const SEED_RECORDS = [
  mk({ id: "r101", hn: "6601234", name: "สมชาย ทองดี", age: 68, ckdStage: "5", date: "2026-05-27",
    scr: "6.2", egfr: "9", k: "5.9", na: "138", bpSys: "158", bpDia: "92", hr: "88", allergy: "Penicillin",
    sources: ["record", "interview", "brought"],
    meds: [
      { drug: "Enalapril", strength: "20 mg", dose: "1x2 pc", actuallyTaking: "1x1", source: "ผู้ป่วย", remark: "ลดเองเพราะเวียนหัว", flags: ["renal", "k"] },
      { drug: "Furosemide", strength: "40 mg", dose: "1x1 เช้า", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] },
      { drug: "Ibuprofen", strength: "400 mg", dose: "เวลาปวด", actuallyTaking: "ซื้อกินเอง", source: "ผู้ป่วย", remark: "ปวดเข่า", flags: ["nephrotoxic", "contra"] },
    ],
    drps: ["contra", "nephrotoxic", "adherence", "electrolyte"], drpDetail: "ผู้ป่วยซื้อ NSAID กินเอง + K⁺ สูง + ลดขนาด ACEI เอง",
    comparedPrev: true, comparedNew: true, discrepancy: "found", discrepancyType: "ผู้ป่วยกินไม่ตรงตามสั่ง + ยานอก",
    interventions: ["inform", "counsel"], counselingNote: "ให้หยุด NSAID, สอนการกินยา",
    outcome: "not_accepted", outcomeReason: "รอพบแพทย์ครั้งหน้า", physician: "นพ.วิชัย",
    pharmacist: "ภก. ธนวัฒน์ รักษ์ไต", createdBy: "u2",
    followUp: { due: "2026-06-03", note: "ติดตามผล K⁺ และการหยุด NSAID" } }),

  mk({ id: "r102", hn: "6605678", name: "มาลี สุขสันต์", age: 59, ckdStage: "4", date: "2026-05-26",
    scr: "3.1", egfr: "22", k: "4.6", na: "140", bpSys: "142", bpDia: "84", hr: "76", allergy: "-",
    sources: ["record", "prev_rx", "interview"],
    meds: [
      { drug: "Metformin", strength: "500 mg", dose: "1x2 pc", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["renal", "contra"] },
      { drug: "Losartan", strength: "50 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["k"] },
      { drug: "Atorvastatin", strength: "40 mg", dose: "1x1 hs", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] },
    ],
    drps: ["renal_dose", "contra"], drpDetail: "Metformin ใน eGFR 22 — ควรหยุด/เปลี่ยน",
    comparedPrev: true, discrepancy: "found", discrepancyType: "ขนาด Metformin ไม่เหมาะกับไต",
    interventions: ["inform", "adjust"], outcome: "accepted", physician: "นพ.วิชัย",
    pharmacist: "ภญ. ปิยะดา วงศ์ไทย", createdBy: "u3",
    followUp: { due: "2026-06-09", note: "ยืนยันการหยุด Metformin" } }),

  mk({ id: "r103", hn: "6609012", name: "ประเสริฐ มั่นคง", age: 72, ckdStage: "3b", date: "2026-05-25",
    scr: "1.9", egfr: "38", k: "4.2", na: "139", bpSys: "134", bpDia: "80", hr: "72", allergy: "-",
    sources: ["record", "interview"],
    meds: [
      { drug: "Amlodipine", strength: "10 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] },
      { drug: "Allopurinol", strength: "300 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["renal"] },
    ],
    drps: ["renal_dose"], drpDetail: "Allopurinol ควรปรับตาม CrCl",
    comparedPrev: true, discrepancy: "found", discrepancyType: "ขนาด Allopurinol",
    interventions: ["adjust"], outcome: "accepted", physician: "นพ.สมหญิง",
    pharmacist: "ภก. ธนวัฒน์ รักษ์ไต", createdBy: "u2" }),

  mk({ id: "r104", hn: "6603344", name: "วันดี ศรีสุข", age: 64, ckdStage: "3a", date: "2026-05-22",
    scr: "1.5", egfr: "52", k: "4.0", na: "141", bpSys: "128", bpDia: "78", hr: "70", allergy: "-",
    sources: ["record"],
    meds: [
      { drug: "Enalapril", strength: "5 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["renal", "k"] },
    ],
    drps: [], comparedPrev: true, discrepancy: "none",
    outcome: "accepted", physician: "นพ.สมหญิง", pharmacist: "ภญ. ปิยะดา วงศ์ไทย", createdBy: "u3" }),

  mk({ id: "r105", hn: "6607788", name: "บุญมา เกษตร", age: 70, ckdStage: "5", date: "2026-05-20",
    scr: "7.8", egfr: "7", k: "6.2", na: "135", bpSys: "166", bpDia: "96", hr: "90", allergy: "Sulfa",
    sources: ["record", "brought", "interview"],
    meds: [
      { drug: "Spironolactone", strength: "25 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["k", "contra"] },
      { drug: "Losartan", strength: "100 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["k"] },
      { drug: "Sodium bicarbonate", strength: "650 mg", dose: "1x3", actuallyTaking: "ไม่สม่ำเสมอ", source: "ผู้ป่วย", remark: "", flags: ["k"] },
    ],
    drps: ["contra", "electrolyte", "ddi", "adherence"], drpDetail: "Spironolactone + ARB ใน eGFR 7, K⁺ 6.2 อันตราย",
    comparedPrev: true, comparedNew: true, discrepancy: "found", discrepancyType: "ยากลุ่มเพิ่ม K⁺ ซ้อนกัน",
    interventions: ["inform", "adjust", "counsel"], outcome: "not_accepted", outcomeReason: "ติดต่อแพทย์ไม่ได้",
    physician: "นพ.วิชัย", pharmacist: "ภญ. สุนิสา ใจดี", createdBy: "u1",
    followUp: { due: "2026-05-30", note: "ด่วน! K⁺ 6.2 ต้องติดตามวันนี้" } }),

  mk({ id: "r106", hn: "6602211", name: "สมหมาย ใจเย็น", age: 55, ckdStage: "2", date: "2026-05-19",
    scr: "1.1", egfr: "78", k: "4.1", na: "140", bpSys: "122", bpDia: "76", hr: "68", allergy: "-",
    sources: ["record"], meds: [{ drug: "Amlodipine", strength: "5 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] }],
    drps: [], discrepancy: "none", outcome: "accepted", pharmacist: "ภก. ธนวัฒน์ รักษ์ไต", createdBy: "u2" }),

  mk({ id: "r107", hn: "6604455", name: "จันทร์ฉาย แสงทอง", age: 61, ckdStage: "4", date: "2026-05-15",
    scr: "2.9", egfr: "24", k: "5.1", na: "138", bpSys: "150", bpDia: "88", hr: "80", allergy: "-",
    sources: ["record", "interview"],
    meds: [
      { drug: "Gliclazide", strength: "80 mg", dose: "1x2", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["renal"] },
      { drug: "Enalapril", strength: "20 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: ["renal", "k"] },
    ],
    drps: ["renal_dose", "electrolyte"], drpDetail: "เฝ้าระวัง K⁺, ปรับ Gliclazide",
    comparedPrev: true, discrepancy: "found", discrepancyType: "ขนาดยาเบาหวาน",
    interventions: ["adjust"], outcome: "accepted", pharmacist: "ภญ. ปิยะดา วงศ์ไทย", createdBy: "u3",
    followUp: { due: "2026-06-05", note: "ติดตาม K⁺" } }),

  mk({ id: "r108", hn: "6608899", name: "อำนวย พูนผล", age: 66, ckdStage: "3b", date: "2026-05-12",
    scr: "2.0", egfr: "40", k: "4.4", na: "139", bpSys: "136", bpDia: "82", hr: "74", allergy: "-",
    sources: ["record", "prev_rx"],
    meds: [
      { drug: "Atorvastatin", strength: "20 mg", dose: "1x1 hs", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] },
      { drug: "Aspirin", strength: "81 mg", dose: "1x1", actuallyTaking: "ตามสั่ง", source: "เวชระเบียน", remark: "", flags: [] },
    ],
    drps: ["duplicate"], drpDetail: "พบยาลดไขมันซ้ำจากคลินิกเอกชน",
    comparedPrev: true, discrepancy: "found", discrepancyType: "ยาซ้ำ",
    interventions: ["counsel"], outcome: "accepted", pharmacist: "ภก. ธนวัฒน์ รักษ์ไต", createdBy: "u2" }),
];

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function fmtDate(s) { if (!s) return "–"; const d = new Date(s); if (isNaN(d)) return s; return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; }

Object.assign(window, {
  SOURCE_OPTIONS, DRP_OPTIONS, INTERVENTION_OPTIONS,
  CKD_STAGES, computeRisk, RISK_META, Store, USERS, SEED_RECORDS,
  TH_MONTHS, fmtDate,
});
