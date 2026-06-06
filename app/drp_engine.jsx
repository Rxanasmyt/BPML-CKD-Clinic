/* =========================================================================
   drp_engine.jsx — เครื่องมือวิเคราะห์ปัญหาด้านยา (DRP) อัตโนมัติ
   ตรวจ: Drug-Drug, Drug-CKD, Drug-Herb/Supplement Interactions + Duplicate Therapy
   อ้างอิง: KDIGO 2024, Lexicomp, Clinical Pharmacokinetics, Thai FDA drug interaction data
   ========================================================================= */

/* ---------- Severity levels ---------- */
const SEV = { HIGH: "HIGH", MED: "MEDIUM", LOW: "LOW" };
const DRPK = {
  duplicate: "duplicate", omission: "omission", renal: "renal_dose",
  contra: "contra", nephrotoxic: "nephrotoxic", electrolyte: "electrolyte",
  ddi: "ddi", adherence: "adherence", overdose: "overdose",
};

/* ---------- Dose parsing helpers ---------- */
// parseStrengthMg("850 mg") → 850 ; "0.25 mg" → 0.25 ; "" → NaN
function parseStrengthNum(s) {
  if (!s) return NaN;
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

// unitsPerDay from structured qty×freq, else parse "1x2" pattern from string
function unitsPerDayOf(qtyPerDose, freqPerDay, doseString) {
  const q = parseFloat(qtyPerDose), fr = parseFloat(freqPerDay);
  if (!isNaN(q) && !isNaN(fr) && q > 0 && fr > 0) return q * fr;
  // fallback: parse "NxM" / "N x M" (N = เม็ด/ครั้ง, M = ครั้ง/วัน)
  if (doseString) {
    const m = String(doseString).match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (m) return parseFloat(m[1]) * parseFloat(m[2]);
  }
  return NaN;
}

// total mg/day for a med given strength + dose pattern
function dailyDoseMg(strength, qtyPerDose, freqPerDay, doseString) {
  const mgPerUnit = parseStrengthNum(strength);
  const upd = unitsPerDayOf(qtyPerDose, freqPerDay, doseString);
  if (isNaN(mgPerUnit) || isNaN(upd)) return NaN;
  return Math.round(mgPerUnit * upd * 10000) / 10000;
}

function fmtDose(n) {
  if (isNaN(n)) return "?";
  return (Math.round(n * 100) / 100).toString();
}

/* ---------- Drug class matcher ---------- */
// classOf(drugName) → lowercase class string from DRUG_DB or HERB_DB
function classOf(name) {
  if (!name) return "";
  const d = lookupDrug(name);
  if (d) return (d.cls || "").toLowerCase();
  const h = lookupHerb(name);
  if (h) return ("herb_" + h.type).toLowerCase();
  return "";
}

// drugMatches: does this drug name/class match a pattern?
function dm(drugName, pattern) {
  if (!drugName || !pattern) return false;
  const n = drugName.toLowerCase();
  const p = pattern.toLowerCase();
  const c = classOf(drugName);
  return n.includes(p) || c.includes(p);
}

// Get drug flags from DB
function drugFlags(name) { const d = lookupDrug(name); return d ? (d.flags || []) : []; }

/* ---------- DDI Rule engine ---------- */
// Rules: { id, match: (drugA, drugB)→bool, sev, msg, rec, drpKey }
// We test each rule against every drug-pair combination in the list.

const DDI_RULES = [
  /* ===== HYPERKALEMIA COMBINATIONS ===== */
  {
    id:"k-acei-arb", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"acei")||dm(a,"enalapril")||dm(a,"lisinopril")||dm(a,"ramipril")||dm(a,"captopril")||dm(a,"perindopril")||dm(a,"imidapril")) && (dm(b,"arb")||dm(b,"losartan")||dm(b,"valsartan")||dm(b,"candesartan")||dm(b,"irbesartan")||dm(b,"telmisartan")||dm(b,"olmesartan")),
    msg:"⚠️ Dual RAS blockade: ACEI + ARB — เพิ่มความเสี่ยง hyperkalemia และ AKI อย่างมาก",
    rec:"ห้ามใช้ร่วมกัน (ONTARGET trial); เลือกใช้ยาตัวใดตัวหนึ่ง", drpKey:DRPK.ddi,
  },
  {
    id:"k-arni-acei", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"arni") && (dm(b,"acei")||dm(b,"enalapril")||dm(b,"lisinopril")),
    msg:"⚠️ ARNI (Sacubitril/Valsartan) + ACEI — เสี่ยง angioedema รุนแรง",
    rec:"ห้ามใช้ร่วมกัน; หยุด ACEI ≥36 ชั่วโมงก่อนเริ่ม ARNI", drpKey:DRPK.ddi,
  },
  {
    id:"k-raa-ksparing", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"acei")||dm(a,"arb")||dm(a,"enalapril")||dm(a,"losartan")||dm(a,"valsartan")||dm(a,"candesartan")||dm(a,"irbesartan")||dm(a,"telmisartan")||dm(a,"ramipril")||dm(a,"lisinopril")) && (dm(b,"spironolactone")||dm(b,"eplerenone")||dm(b,"amiloride")||dm(b,"k-sparing")),
    msg:"⚠️ ACEI/ARB + K-sparing diuretic — ความเสี่ยง hyperkalemia สูงมากใน CKD",
    rec:"ติดตาม K⁺ ทุก 1-2 สัปดาห์แรก; หลีกเลี่ยงถ้า K⁺>5.0 หรือ eGFR<30", drpKey:DRPK.electrolyte,
  },
  {
    id:"k-raa-tmpsmx", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"acei")||dm(a,"arb")||dm(a,"enalapril")||dm(a,"losartan")||dm(a,"ramipril")) && (dm(b,"trimethoprim")||dm(b,"tmp")||dm(b,"sulfamethoxazole")),
    msg:"⚠️ ACEI/ARB + TMP-SMX — TMP บล็อก tubular K⁺ secretion → hyperkalemia รุนแรงใน CKD",
    rec:"ติดตาม K⁺ ภายใน 3-5 วัน; พิจารณาเปลี่ยน antibiotic; ระวัง eGFR ลด", drpKey:DRPK.electrolyte,
  },
  {
    id:"k-raa-ksupplement", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"acei")||dm(a,"arb")||dm(a,"enalapril")||dm(a,"losartan")) && (dm(b,"potassium chloride")||dm(b,"potassium supplement")||dm(b,"โพแทสเซียม")),
    msg:"⚠️ ACEI/ARB + K supplement — hyperkalemia อันตราย โดยเฉพาะใน CKD",
    rec:"หลีกเลี่ยงการให้ K supplement ร่วมกับ ACEI/ARB ใน CKD; ตรวจ K⁺ ก่อนให้", drpKey:DRPK.electrolyte,
  },
  {
    id:"k-ksparing-ksupplement", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"spironolactone")||dm(a,"eplerenone")||dm(a,"amiloride")) && (dm(b,"potassium")||dm(b,"โพแทสเซียม")),
    msg:"⚠️ K-sparing diuretic + K supplement — hyperkalemia รุนแรง",
    rec:"ห้ามใช้ร่วมกัน; หยุด K supplement ทันที", drpKey:DRPK.electrolyte,
  },
  {
    id:"k-licorice-digoxin", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"ชะเอมเทศ")||dm(a,"licorice")) && dm(b,"digoxin"),
    msg:"⚠️ ชะเอมเทศ + Digoxin — ชะเอมเทศลด K⁺ → เพิ่มความเป็นพิษของ Digoxin",
    rec:"ห้ามใช้ร่วมกัน; Digoxin toxicity อาจถึงแก่ชีวิต", drpKey:DRPK.ddi,
  },

  /* ===== NSAID INTERACTIONS ===== */
  {
    id:"nsaid-acei-arb", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"nsaid")||dm(a,"ibuprofen")||dm(a,"naproxen")||dm(a,"diclofenac")||dm(a,"celecoxib")) && (dm(b,"acei")||dm(b,"arb")||dm(b,"enalapril")||dm(b,"losartan")||dm(b,"ramipril")),
    msg:"⚠️ NSAID + ACEI/ARB — ลดประสิทธิภาพ renoprotection; เสี่ยง AKI สูงมาก ('Triple whammy' ถ้ามี diuretic ด้วย)",
    rec:"หยุด NSAID ทันที; ใช้ paracetamol แทน; ติดตาม Scr และ BP", drpKey:DRPK.nephrotoxic,
  },
  {
    id:"nsaid-anticoag", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"nsaid")||dm(a,"ibuprofen")||dm(a,"naproxen")||dm(a,"diclofenac")) && (dm(b,"warfarin")||dm(b,"apixaban")||dm(b,"rivaroxaban")||dm(b,"dabigatran")||dm(b,"anticoagulant")),
    msg:"⚠️ NSAID + Anticoagulant — เสี่ยงเลือดออก GI รุนแรงมาก",
    rec:"ห้ามร่วมกัน; ใช้ paracetamol แทน; ถ้าจำเป็นต้องใช้ anti-pain ปรึกษาแพทย์", drpKey:DRPK.ddi,
  },
  {
    id:"nsaid-diuretic", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"nsaid")||dm(a,"ibuprofen")||dm(a,"naproxen")) && (dm(b,"furosemide")||dm(b,"torsemide")||dm(b,"loop diuretic")||dm(b,"hydrochlorothiazide")),
    msg:"⚠️ NSAID + Diuretic + CKD — 'Triple Whammy': AKI สูงมาก; ลดประสิทธิภาพยาขับปัสสาวะ",
    rec:"หยุด NSAID ทันที; ติดตาม fluid status และ Scr", drpKey:DRPK.nephrotoxic,
  },
  {
    id:"nsaid-ssri", sev:SEV.MED,
    match:(a,b)=>(dm(a,"nsaid")||dm(a,"ibuprofen")||dm(a,"naproxen")) && (dm(b,"ssri")||dm(b,"sertraline")||dm(b,"escitalopram")||dm(b,"fluoxetine")),
    msg:"NSAID + SSRI — เพิ่มความเสี่ยง GI bleeding (synergistic effect)",
    rec:"ติดตาม GI symptoms; พิจารณาใช้ PPI ป้องกัน; เปลี่ยนเป็น paracetamol ดีกว่า", drpKey:DRPK.ddi,
  },

  /* ===== DIGOXIN TOXICITY ===== */
  {
    id:"digoxin-loop", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"digoxin") && (dm(b,"furosemide")||dm(b,"torsemide")||dm(b,"loop diuretic")||dm(b,"hydrochlorothiazide")||dm(b,"thiazide")),
    msg:"⚠️ Digoxin + Loop/Thiazide diuretic — hypokalemia → เพิ่ม Digoxin toxicity",
    rec:"ติดตาม K⁺ และ Digoxin level; เป้าหมาย K⁺>4.0 และ Dig level 0.5-0.9 ng/mL", drpKey:DRPK.electrolyte,
  },
  {
    id:"digoxin-amio", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"digoxin") && dm(b,"amiodarone"),
    msg:"⚠️ Digoxin + Amiodarone — ↑ Digoxin level 70-100%; เสี่ยง toxicity รุนแรง",
    rec:"ลด Digoxin dose 50% เมื่อเริ่ม Amiodarone; ติดตาม ECG และ Dig level", drpKey:DRPK.ddi,
  },
  {
    id:"digoxin-clarithro", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"digoxin") && (dm(b,"clarithromycin")||dm(b,"erythromycin")),
    msg:"⚠️ Digoxin + Clarithromycin/Erythromycin — ↑ Digoxin level; เสี่ยง toxicity",
    rec:"ติดตาม Digoxin level; พิจารณาเปลี่ยน antibiotic; ลด Dig dose ชั่วคราว", drpKey:DRPK.ddi,
  },

  /* ===== ANTICOAGULANT INTERACTIONS ===== */
  {
    id:"warfarin-amio", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"warfarin") && dm(b,"amiodarone"),
    msg:"⚠️ Warfarin + Amiodarone — ↑ INR มาก (inhibit CYP2C9); เสี่ยงเลือดออก",
    rec:"ลด Warfarin dose 30-50%; ติดตาม INR ทุกสัปดาห์จนคงที่", drpKey:DRPK.ddi,
  },
  {
    id:"warfarin-tmpsmx", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"warfarin") && (dm(b,"trimethoprim")||dm(b,"tmp-smx")||dm(b,"sulfamethoxazole")),
    msg:"⚠️ Warfarin + TMP-SMX — ↑ INR อย่างมาก; เสี่ยงเลือดออก",
    rec:"ติดตาม INR ภายใน 3-5 วัน; อาจต้องลด Warfarin dose 25%", drpKey:DRPK.ddi,
  },
  {
    id:"warfarin-fq", sev:SEV.MED,
    match:(a,b)=>dm(a,"warfarin") && (dm(b,"ciprofloxacin")||dm(b,"levofloxacin")||dm(b,"fluoroquinolone")),
    msg:"Warfarin + Fluoroquinolone — ↑ INR ปานกลาง (ลด gut flora); ระวัง",
    rec:"ติดตาม INR ภายใน 5-7 วัน ขณะใช้ antibiotic", drpKey:DRPK.ddi,
  },
  {
    id:"warfarin-aspirin", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"warfarin") && (dm(b,"aspirin")&&!dm(b,"antiplatelet")),
    msg:"⚠️ Warfarin + Aspirin dose สูง — เสี่ยงเลือดออก GI และ intracranial",
    rec:"ใช้ aspirin low-dose (81-100 mg) เท่านั้นถ้าจำเป็น; ติดตาม INR และ bleeding signs", drpKey:DRPK.ddi,
  },

  /* ===== STATIN INTERACTIONS ===== */
  {
    id:"statin-gemfibrozil", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"statin")||dm(a,"simvastatin")||dm(a,"atorvastatin")||dm(a,"rosuvastatin")) && dm(b,"gemfibrozil"),
    msg:"⚠️ Statin + Gemfibrozil — เสี่ยง rhabdomyolysis รุนแรง",
    rec:"ห้ามใช้ร่วมกัน; เปลี่ยนเป็น fenofibrate (ปลอดภัยกว่ากับ statin)", drpKey:DRPK.ddi,
  },
  {
    id:"statin-fenofibrate", sev:SEV.MED,
    match:(a,b)=>(dm(a,"statin")||dm(a,"simvastatin")||dm(a,"atorvastatin")||dm(a,"rosuvastatin")||dm(a,"pravastatin")) && dm(b,"fenofibrate"),
    msg:"Statin + Fenofibrate — เพิ่มความเสี่ยง myopathy/rhabdomyolysis (น้อยกว่า gemfibrozil)",
    rec:"ติดตาม CK และอาการปวดกล้ามเนื้อ; ระวังใน CKD (fenofibrate สะสม); หลีกเลี่ยง eGFR<30", drpKey:DRPK.ddi,
  },
  {
    id:"metformin-contrast", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"metformin") && (dm(b,"contrast")||dm(b,"iodinated")||dm(b,"สารทึบรังสี")||dm(b,"iohexol")||dm(b,"iodixanol")),
    msg:"⚠️ Metformin + Iodinated contrast — เสี่ยง contrast-induced AKI → lactic acidosis",
    rec:"หยุด Metformin ก่อนฉีดสารทึบรังสี 48 ชม.; ตรวจ Scr ก่อนเริ่มยาใหม่; ให้ hydration", drpKey:DRPK.nephrotoxic,
  },
  {
    id:"simva-amio", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"simvastatin") && dm(b,"amiodarone"),
    msg:"⚠️ Simvastatin + Amiodarone — ↑ Simvastatin level; เสี่ยง myopathy/rhabdomyolysis",
    rec:"Max Simvastatin 20 mg/day ถ้าใช้ร่วม Amiodarone; พิจารณาเปลี่ยนเป็น Rosuvastatin หรือ Pravastatin", drpKey:DRPK.ddi,
  },

  /* ===== NEPHROTOXIC COMBINATIONS ===== */
  {
    id:"nephrotox-combo", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"gentamicin")||dm(a,"aminoglycoside")) && (dm(b,"vancomycin")||dm(b,"furosemide")||dm(b,"amphotericin")),
    msg:"⚠️ Aminoglycoside + Vancomycin/Loop diuretic — nephrotoxicity ซ้อนกัน อันตรายมาก",
    rec:"ติดตาม Scr ทุกวัน; ให้ hydration เพียงพอ; ใช้ drug level monitoring", drpKey:DRPK.nephrotoxic,
  },
  {
    id:"cyclosporin-nsaid", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"cyclosporin")||dm(a,"tacrolimus")) && (dm(b,"nsaid")||dm(b,"ibuprofen")||dm(b,"naproxen")),
    msg:"⚠️ Calcineurin inhibitor + NSAID — nephrotoxicity รุนแรง",
    rec:"ห้ามใช้ร่วมกัน", drpKey:DRPK.nephrotoxic,
  },

  /* ===== COLCHICINE INTERACTIONS ===== */
  {
    id:"colchicine-clarithro", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"colchicine") && (dm(b,"clarithromycin")||dm(b,"erythromycin")),
    msg:"⚠️ Colchicine + Clarithromycin — ↑ Colchicine level มาก; เสี่ยงพิษถึงแก่ชีวิต",
    rec:"ห้ามใช้ร่วมกัน; เปลี่ยน antibiotic; ถ้าจำเป็นลด Colchicine เป็น 0.5 mg วันเว้นวัน", drpKey:DRPK.ddi,
  },
  {
    id:"colchicine-statin", sev:SEV.MED,
    match:(a,b)=>dm(a,"colchicine") && (dm(b,"statin")||dm(b,"simvastatin")||dm(b,"atorvastatin")),
    msg:"Colchicine + Statin — เสี่ยง myopathy; เพิ่มโอกาส rhabdomyolysis",
    rec:"ติดตาม CK; แจ้งผู้ป่วยเรื่อง muscle pain/weakness", drpKey:DRPK.ddi,
  },

  /* ===== QTC PROLONGATION ===== */
  {
    id:"qtc-amio-fq", sev:SEV.HIGH,
    match:(a,b)=>dm(a,"amiodarone") && (dm(b,"ciprofloxacin")||dm(b,"levofloxacin")||dm(b,"fluoroquinolone")),
    msg:"⚠️ Amiodarone + Fluoroquinolone — QTc prolongation ทั้งคู่ → เสี่ยง Torsades de Pointes",
    rec:"ติดตาม ECG; หลีกเลี่ยงถ้าเป็นไปได้; ตรวจ K⁺ และ Mg²⁺", drpKey:DRPK.ddi,
  },

  /* ===== ABSORPTION INTERACTIONS ===== */
  {
    id:"ca-fq", sev:SEV.MED,
    match:(a,b)=>(dm(a,"calcium carbonate")||dm(a,"sevelamer")||dm(a,"lanthanum")||dm(a,"แคลเซียม")) && (dm(b,"ciprofloxacin")||dm(b,"levofloxacin")||dm(b,"fluoroquinolone")),
    msg:"Phosphate binder/Calcium + Fluoroquinolone — ลด antibiotic absorption ได้ถึง 50%",
    rec:"กิน antibiotic ก่อน phosphate binder/Ca อย่างน้อย 2 ชั่วโมง หรือ 6 ชั่วโมงหลัง", drpKey:DRPK.ddi,
  },
  {
    id:"psyllium-drugs", sev:SEV.LOW,
    match:(a,b)=>(dm(a,"psyllium")||dm(a,"ไฟเบอร์")) && (dm(b,"digoxin")||dm(b,"warfarin")||dm(b,"lithium")),
    msg:"Psyllium fiber — อาจลด absorption ของยาสำคัญ",
    rec:"กิน Psyllium ห่างจากยาอื่น 2-4 ชั่วโมง", drpKey:DRPK.ddi,
  },

  /* ===== SGLT2i COMBINATIONS ===== */
  {
    id:"sglt2-loop", sev:SEV.MED,
    match:(a,b)=>(dm(a,"sglt2")||dm(a,"dapagliflozin")||dm(a,"empagliflozin")||dm(a,"canagliflozin")) && (dm(b,"furosemide")||dm(b,"torsemide")||dm(b,"loop diuretic")),
    msg:"SGLT2 inhibitor + Loop diuretic — volume depletion; เสี่ยง AKI และ DKA ใน CKD",
    rec:"ติดตาม fluid status, Scr, glucose; หลีกเลี่ยง dehydration; ระวัง eGFR ลด", drpKey:DRPK.ddi,
  },

  /* ===== ALLOPURINOL ===== */
  {
    id:"allopurinol-thiazide", sev:SEV.MED,
    match:(a,b)=>dm(a,"allopurinol") && (dm(b,"hydrochlorothiazide")||dm(b,"indapamide")||dm(b,"thiazide")),
    msg:"Allopurinol + Thiazide — ↑ เสี่ยง allopurinol hypersensitivity syndrome (SJS/TEN); ↑ oxipurinol level",
    rec:"ใช้ด้วยความระมัดระวัง; ระวัง SJS ใน HLA-B*5801 positive (Thai population สูง); พิจารณา Febuxostat แทน", drpKey:DRPK.ddi,
  },

  /* ===== HERB-DRUG ===== */
  {
    id:"herb-turmeric-anticoag", sev:SEV.MED,
    match:(a,b)=>(dm(a,"ขมิ้น")||dm(a,"turmeric")||dm(a,"curcumin")) && (dm(b,"warfarin")||dm(b,"apixaban")||dm(b,"anticoag")),
    msg:"ขมิ้นชัน + Anticoagulant — เพิ่ม bleeding risk; ↑ INR possible",
    rec:"ควรหยุดอาหารเสริมขมิ้น; ติดตาม INR ถ้าใช้ warfarin", drpKey:DRPK.ddi,
  },
  {
    id:"herb-fishoil-anticoag", sev:SEV.MED,
    match:(a,b)=>(dm(a,"น้ำมันปลา")||dm(a,"fish oil")||dm(a,"omega-3")||dm(a,"โอเมก้า")) && (dm(b,"warfarin")||dm(b,"apixaban")||dm(b,"aspirin")||dm(b,"clopidogrel")),
    msg:"น้ำมันปลา/Omega-3 ขนาดสูง + Anticoagulant/Antiplatelet — เพิ่ม bleeding risk",
    rec:"จำกัด fish oil ≤1-2 g/day ถ้าใช้ anticoagulant; ติดตาม INR", drpKey:DRPK.ddi,
  },
  {
    id:"herb-bittermelon-dm", sev:SEV.MED,
    match:(a,b)=>(dm(a,"มะระ")||dm(a,"bitter melon")) && (dm(b,"insulin")||dm(b,"glipizide")||dm(b,"gliclazide")||dm(b,"sulfonylurea")||dm(b,"sitagliptin")),
    msg:"มะระขี้นก + ยาเบาหวาน — เพิ่มฤทธิ์ลดน้ำตาล → เสี่ยง hypoglycemia",
    rec:"ติดตาม blood glucose; ลด dose ยาเบาหวานถ้าจำเป็น", drpKey:DRPK.ddi,
  },
  {
    id:"herb-licorice-htn", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"ชะเอมเทศ")||dm(a,"licorice")) && (dm(b,"enalapril")||dm(b,"losartan")||dm(b,"amlodipine")||dm(b,"furosemide")||dm(b,"acei")||dm(b,"arb")),
    msg:"⚠️ ชะเอมเทศ + ยาความดัน — ชะเอมเทศเพิ่ม BP และ Na⁺, ลด K⁺ → ลดประสิทธิภาพยา",
    rec:"ห้ามใช้ร่วมกัน ใน CKD+HTN; ให้หยุดชะเอมเทศทันที", drpKey:DRPK.ddi,
  },
  {
    id:"herb-ginger-anticoag", sev:SEV.LOW,
    match:(a,b)=>(dm(a,"ขิง")||dm(a,"ginger")) && (dm(b,"warfarin")||dm(b,"aspirin")||dm(b,"anticoag")),
    msg:"ขิงขนาดสูง + Anticoagulant — เพิ่ม bleeding risk เล็กน้อย",
    rec:"ปริมาณอาหารปกติปลอดภัย; ระวังอาหารเสริม ขิงขนาดสูง", drpKey:DRPK.ddi,
  },
  {
    id:"herb-mg-ckd", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"แมกนีเซียม")||dm(a,"magnesium")) && (dm(b,"furosemide")||dm(b,"any")),
    msg:"⚠️ Magnesium supplement ใน CKD — สะสมง่าย → hypermagnesemia → cardiac/respiratory arrest",
    rec:"AVOID Mg supplement ถ้า eGFR<30; ปรึกษาแพทย์ก่อนใช้", drpKey:DRPK.electrolyte,
  },
  {
    id:"herb-aloe-diuretic", sev:SEV.MED,
    match:(a,b)=>(dm(a,"ว่านหางจระเข้")||dm(a,"aloe vera")) && (dm(b,"furosemide")||dm(b,"hydrochlorothiazide")||dm(b,"digoxin")),
    msg:"Aloe vera กิน + Diuretic/Digoxin — ท้องเสีย → ↓ K⁺ → เพิ่มพิษ Digoxin",
    rec:"ระวังการกินว่านหางจระเข้ (สด); ติดตาม K⁺", drpKey:DRPK.electrolyte,
  },
  {
    id:"herb-coconut-ckd", sev:SEV.HIGH,
    match:(a,b)=>(dm(a,"น้ำมะพร้าว")||dm(a,"coconut water")) && (dm(b,"enalapril")||dm(b,"losartan")||dm(b,"spironolactone")||dm(b,"acei")||dm(b,"arb")),
    msg:"⚠️ น้ำมะพร้าว (K⁺ สูง) + ACEI/ARB/K-sparing — hyperkalemia อันตรายใน CKD",
    rec:"จำกัดน้ำมะพร้าว ≤120 mL/day หรือหลีกเลี่ยงใน CKD ที่ใช้ยากลุ่มนี้", drpKey:DRPK.electrolyte,
  },
  {
    id:"herb-vitc-oxalate", sev:SEV.MED,
    match:(a,b)=>(dm(a,"วิตามิน ซี")||dm(a,"vitamin c")) && (dm(b,"any")),
    msg:"Vitamin C ขนาดสูง ใน CKD — เปลี่ยนเป็น oxalate → oxalate nephropathy ใน CKD",
    rec:"Max Vit C 60-90 mg/day ใน CKD; ห้ามเสริม >500 mg/day", drpKey:DRPK.nephrotoxic,
  },
];

/* ---------- Duplicate therapy detection ---------- */
const DUP_CLASSES = [
  { name:"ACEI", patterns:["acei","enalapril","lisinopril","ramipril","captopril","perindopril","imidapril"] },
  { name:"ARB", patterns:["arb","losartan","valsartan","candesartan","irbesartan","telmisartan","olmesartan"] },
  { name:"NSAID", patterns:["nsaid","ibuprofen","naproxen","diclofenac","celecoxib"] },
  { name:"Statin", patterns:["statin","atorvastatin","simvastatin","rosuvastatin","pravastatin","pitavastatin","fluvastatin"] },
  { name:"Loop diuretic", patterns:["loop diuretic","furosemide","torsemide","bumetanide"] },
  { name:"Beta-blocker", patterns:["beta-blocker","metoprolol","carvedilol","atenolol","bisoprolol","nebivolol"] },
  { name:"CCB", patterns:["ccb","amlodipine","felodipine","nifedipine","diltiazem","verapamil"] },
  { name:"PPI", patterns:["ppi","omeprazole","pantoprazole","esomeprazole","rabeprazole"] },
  { name:"K-sparing diuretic", patterns:["k-sparing","spironolactone","eplerenone","amiloride"] },
  { name:"XOI (urate-lowering)", patterns:["xanthine oxidase","allopurinol","febuxostat"] },
  { name:"DPP-4 inhibitor", patterns:["dpp-4","sitagliptin","vildagliptin","saxagliptin","linagliptin"] },
  { name:"Phosphate binder", patterns:["phosphate binder","calcium carbonate","sevelamer","lanthanum"] },
];

/* ---------- CKD-specific eGFR contraindications ---------- */
const EGFR_RULES = [
  { drugs:["metformin"], threshold:30, sev:SEV.HIGH, msg:"Metformin — STOP ถ้า eGFR<30 (lactic acidosis risk)", rec:"หยุดยาและปรึกษาแพทย์เปลี่ยนเป็น DPP-4i หรือ SGLT2i ที่ปลอดภัยกว่า", drpKey:DRPK.contra },
  { drugs:["glibenclamide"], threshold:60, sev:SEV.HIGH, msg:"Glibenclamide — ห้ามใช้ใน CKD (active metabolite สะสม → hypoglycemia รุนแรง)", rec:"เปลี่ยนเป็น Gliclazide หรือ Linagliptin", drpKey:DRPK.contra },
  { drugs:["spironolactone","eplerenone"], threshold:30, sev:SEV.HIGH, msg:"Spironolactone/Eplerenone — AVOID eGFR<30 (hyperkalemia)", rec:"หยุดยา; ใช้ Furosemide แทน", drpKey:DRPK.contra },
  { drugs:["nitrofurantoin"], threshold:30, sev:SEV.HIGH, msg:"Nitrofurantoin — ไม่ออกฤทธิ์และ toxic ใน eGFR<30 (peripheral neuropathy)", rec:"เปลี่ยน antibiotic; ปรึกษาแพทย์", drpKey:DRPK.contra },
  { drugs:["dabigatran"], threshold:30, sev:SEV.HIGH, msg:"Dabigatran — AVOID eGFR<30 (80% renal excretion; เลือดออกรุนแรง)", rec:"เปลี่ยนเป็น Apixaban (ปลอดภัยกว่าใน CKD)", drpKey:DRPK.contra },
  { drugs:["aluminum hydroxide","แอนตาซิด al","antacid al"], threshold:60, sev:SEV.HIGH, msg:"Aluminum antacid — Al สะสมใน CKD → encephalopathy, osteomalacia", rec:"เปลี่ยนเป็น Calcium carbonate หรือ Sevelamer; ห้ามใช้ระยะยาว", drpKey:DRPK.nephrotoxic },
  { drugs:["colchicine"], threshold:30, sev:SEV.HIGH, msg:"Colchicine — AVOID eGFR<30 (neuromyopathy สะสม)", rec:"ใช้ Prednisolone แทนใน acute gout; ปรึกษาแพทย์", drpKey:DRPK.contra },
  { drugs:["fenofibrate"], threshold:30, sev:SEV.MED, msg:"Fenofibrate — AVOID eGFR<30; เพิ่ม Scr และ rhabdomyolysis", rec:"หยุดยา; ใช้ Ezetimibe หรือ statin แทน", drpKey:DRPK.renal },
];

/* ---------- ฟังก์ชันวิเคราะห์หลัก ---------- */
function analyzeDRPs({ meds = [], otcItems = [], egfr, k, ckdStage, hb, hco3, phos, ca, bpSys, bpDia, uacr, dm: hasDM }) {
  const allDrugs = [
    ...meds.map((m) => ({ name: m.drug, source: "med" })),
    ...otcItems.map((o) => ({ name: o.name, source: "otc" })),
  ].filter((d) => d.name && d.name.trim());

  const findings = [];
  const seen = new Set();

  function addFinding(f) {
    const key = f.id || (f.msg.substring(0, 30));
    if (!seen.has(key)) { seen.add(key); findings.push(f); }
  }

  const eg = parseFloat(egfr);
  const kVal = parseFloat(k);

  // 1. eGFR-based contraindications
  if (!isNaN(eg)) {
    allDrugs.forEach((d) => {
      EGFR_RULES.forEach((rule) => {
        if (eg < rule.threshold && rule.drugs.some((p) => dm(d.name, p))) {
          addFinding({ ...rule, drugs: [d.name], id: rule.drugs[0] + "_egfr" });
        }
      });
    });
  }

  // 2. Nephrotoxic flags from drug DB
  allDrugs.forEach((d) => {
    const flags = drugFlags(d.name);
    if (flags.includes("nephrotoxic")) {
      addFinding({ sev: SEV.HIGH, msg: `${d.name} — ยา Nephrotoxic; ระวังเป็นพิเศษใน CKD`, rec:"ทบทวนความจำเป็น; ใช้ขนาดน้อยที่สุด; ติดตาม Scr", drpKey:DRPK.nephrotoxic, drugs:[d.name] });
    }
    if (flags.includes("k") && !isNaN(kVal) && kVal >= 5.0) {
      addFinding({ sev: kVal >= 5.5 ? SEV.HIGH : SEV.MED, msg: `${d.name} เพิ่ม K⁺ และผู้ป่วยมี K⁺=${k} mmol/L อยู่แล้ว`, rec:"ติดตาม K⁺ อย่างใกล้ชิด; พิจารณาลด dose หรือเปลี่ยนยา", drpKey:DRPK.electrolyte, drugs:[d.name] });
    }
  });

  // 2b. ขนาดรวมเกิน (total daily dose) + ผู้ป่วยกินจริงต่างจากสั่ง (adherence)
  meds.forEach((m) => {
    if (!m.drug || !m.drug.trim()) return;
    const maxInfo = (typeof maxDailyDoseFor === "function") ? maxDailyDoseFor(m.drug, egfr) : null;

    // ขนาดที่แพทย์สั่ง
    const presc = dailyDoseMg(m.strength, m.qtyPerDose, m.freqPerDay, m.dose);

    // ขนาดที่ผู้ป่วยกินจริง (ถ้ามีข้อมูลแยก)
    const sameAsRx = m.sameAsPrescribed !== false; // default: กินตามสั่ง
    const actual = sameAsRx ? presc : dailyDoseMg(m.strength, m.actualQty, m.actualFreq, m.actuallyTaking);

    // renal cap = 0 → ห้ามใช้ยานี้ที่ eGFR ปัจจุบัน (ยกเว้นที่ถูกฟ้องโดยกฎ contra/nephrotoxic แล้ว)
    if (maxInfo && maxInfo.renal && maxInfo.max === 0) {
      const alreadyFlagged = findings.some((fd) =>
        (fd.drpKey === DRPK.contra || fd.drpKey === DRPK.renal || fd.drpKey === DRPK.nephrotoxic) &&
        (fd.drugs || []).some((dn) => dm(dn, m.drug) || dm(m.drug, dn)));
      if (!alreadyFlagged) {
        addFinding({
          sev: SEV.HIGH,
          msg: `⚠️ ${m.drug} — ไม่ควรใช้ที่ eGFR=${egfr} (ขนาดที่ปรับตามไตแล้ว = ห้ามใช้)`,
          rec: `หยุดยาหรือเปลี่ยนเป็นยาที่ปลอดภัยกว่าใน CKD ระยะนี้; ปรึกษาแพทย์`,
          drpKey: DRPK.contra, drugs: [m.drug], id: "renalavoid_" + m.drug,
        });
      }
    }

    // ตรวจขนาดสั่งเกิน max
    if (maxInfo && maxInfo.max > 0 && !isNaN(presc) && presc > maxInfo.max + 0.001) {
      const overByEgfr = maxInfo.renal;
      addFinding({
        sev: overByEgfr ? SEV.HIGH : SEV.MED,
        msg: `⚠️ ${m.drug} ${m.strength || ""} ขนาดรวม ${fmtDose(presc)} ${maxInfo.unit}/วัน เกินขนาดสูงสุด${overByEgfr ? ` ที่ปรับตาม eGFR=${egfr}` : ""} (${fmtDose(maxInfo.max)} ${maxInfo.unit}/วัน)`,
        rec: overByEgfr
          ? `ลดขนาดยาให้ ≤${fmtDose(maxInfo.max)} ${maxInfo.unit}/วัน ตามการทำงานของไต หรือปรึกษาแพทย์`
          : `ทบทวนขนาดยา; ลดให้ ≤${fmtDose(maxInfo.max)} ${maxInfo.unit}/วัน`,
        drpKey: DRPK.overdose, drugs: [m.drug], id: "overdose_rx_" + m.drug,
      });
    }

    // ตรวจขนาดที่กินจริงเกิน max (กรณีกินจริงต่างจากสั่ง)
    if (maxInfo && maxInfo.max > 0 && !sameAsRx && !isNaN(actual) && actual > maxInfo.max + 0.001) {
      addFinding({
        sev: SEV.HIGH,
        msg: `⚠️ ${m.drug}: ผู้ป่วยกินจริง ${fmtDose(actual)} ${maxInfo.unit}/วัน เกินขนาดสูงสุด (${fmtDose(maxInfo.max)} ${maxInfo.unit}/วัน) — เสี่ยงพิษจากยา`,
        rec: `ทบทวนพฤติกรรมการกินยา; ให้คำแนะนำผู้ป่วย; แจ้งแพทย์`,
        drpKey: DRPK.overdose, drugs: [m.drug], id: "overdose_actual_" + m.drug,
      });
    }

    // ตรวจกินจริงต่างจากสั่ง (adherence / discrepancy)
    if (!sameAsRx && !isNaN(presc) && !isNaN(actual) && Math.abs(actual - presc) > 0.001) {
      const more = actual > presc;
      addFinding({
        sev: SEV.MED,
        msg: `${m.drug}: ผู้ป่วยกินจริง ${fmtDose(actual)} ${maxInfo ? maxInfo.unit : "mg"}/วัน ${more ? "มากกว่า" : "น้อยกว่า"}ที่แพทย์สั่ง (${fmtDose(presc)})`,
        rec: more
          ? `ผู้ป่วยกินเกินคำสั่ง — ประเมินสาเหตุ (เข้าใจผิด/อาการไม่ดีขึ้น); ให้คำแนะนำ`
          : `ผู้ป่วยกินไม่ครบตามสั่ง — ประเมิน adherence (ลืม/กลัวผลข้างเคียง/ราคา); ให้คำแนะนำ`,
        drpKey: DRPK.adherence, drugs: [m.drug], id: "adherence_" + m.drug,
      });
    }
  });

  // 2c. ขนาดสมุนไพร/อาหารเสริมเกิน (supplement overdose)
  otcItems.forEach((o) => {
    if (!o.name) return;
    const hd = (typeof maxDailyHerbFor === "function") ? maxDailyHerbFor(o.name) : null;
    if (!hd) return;
    // parse mg/day from free-text amount: "1000 mg x2" → 2000
    const numM = String(o.dose || "").match(/(\d+(?:\.\d+)?)/);
    const amt = numM ? parseFloat(numM[1]) : NaN;
    const freqM = String(o.dose || "").match(/[xX×]\s*(\d+(?:\.\d+)?)/);
    const fr = freqM ? parseFloat(freqM[1]) : 1;
    const daily = isNaN(amt) ? NaN : amt * fr;

    if (hd.maxDaily === 0) {
      // ห้ามใช้ใน CKD ไม่ว่าขนาดเท่าไร
      addFinding({
        sev: SEV.HIGH,
        msg: `⚠️ ${o.name}${o.dose ? ` (${o.dose})` : ""} — ${hd.note}`,
        rec: `หลีกเลี่ยงใน CKD; แนะนำผู้ป่วยให้หยุด; ปรึกษาแพทย์`,
        drpKey: DRPK.overdose, drugs: [o.name], id: "herb_avoid_" + o.name,
      });
    } else if (!isNaN(daily) && daily > hd.maxDaily + 0.001) {
      addFinding({
        sev: SEV.HIGH,
        msg: `⚠️ ${o.name}: ${fmtDose(daily)} ${hd.unit}/วัน เกินขนาดสูงสุด (${fmtDose(hd.maxDaily)} ${hd.unit}/วัน) — ${hd.note}`,
        rec: `ลดขนาดให้ ≤${fmtDose(hd.maxDaily)} ${hd.unit}/วัน หรือหยุด; ให้คำแนะนำผู้ป่วย`,
        drpKey: DRPK.overdose, drugs: [o.name], id: "herb_overdose_" + o.name,
      });
    }
  });

  // 3. DDI rules — test every drug pair
  for (let i = 0; i < allDrugs.length; i++) {
    for (let j = i + 1; j < allDrugs.length; j++) {
      const a = allDrugs[i].name, b = allDrugs[j].name;
      DDI_RULES.forEach((rule) => {
        if (rule.match(a, b) || rule.match(b, a)) {
          addFinding({ ...rule, drugs: [a, b] });
        }
      });
    }
  }

  // 4. Duplicate therapy
  DUP_CLASSES.forEach((dc) => {
    const matched = allDrugs.filter((d) => dc.patterns.some((p) => dm(d.name, p)));
    if (matched.length >= 2) {
      addFinding({ sev: SEV.MED, msg: `ยาซ้ำกลุ่มเดียวกัน (${dc.name}): ${matched.map((m)=>m.name).join(", ")}`, rec:"ทบทวนรายการยา; ใช้เพียงตัวใดตัวหนึ่งในกลุ่มเดียวกัน", drpKey:DRPK.duplicate, drugs:matched.map((m)=>m.name), id:"dup_"+dc.name });
    }
  });

  // 5. Missing renoprotection check
  const hasACEI_ARB = allDrugs.some((d) => dm(d.name,"acei")||dm(d.name,"enalapril")||dm(d.name,"losartan")||dm(d.name,"ramipril")||dm(d.name,"arb"));
  const hasSGLT2 = allDrugs.some((d) => dm(d.name,"sglt2")||dm(d.name,"dapagliflozin")||dm(d.name,"empagliflozin"));
  const ckdNum = parseInt((ckdStage||"0").replace(/[^0-9]/g,"")) || 0;
  if (ckdNum >= 3 && !hasACEI_ARB && !hasSGLT2) {
    addFinding({ sev:SEV.LOW, msg:"ไม่มียา renoprotective (ACEI/ARB/SGLT2i) ในรายการยา — ควรประเมินความจำเป็น", rec:"พิจารณา ACEI หรือ ARB หรือ SGLT2i ตาม guideline (KDIGO 2024) ถ้าไม่มีข้อห้าม", drpKey:DRPK.omission, drugs:[], id:"missing_renoprot" });
  }

  // ---------- helper predicates (drug presence by class) ----------
  const hasDrug = (...pats) => allDrugs.some((d) => pats.some((p) => dm(d.name, p)));
  const hasACEIARB = () => hasDrug("acei","arb","enalapril","lisinopril","ramipril","captopril","perindopril","imidapril","losartan","valsartan","candesartan","irbesartan","telmisartan","olmesartan");
  const hasKsparing = () => hasDrug("spironolactone","eplerenone","amiloride","k-sparing");
  const hasESAorIron = () => hasDrug("esa","epoetin","darbepoetin","methoxy polyethylene","iron","ferrous","ferric","ธาตุเหล็ก");
  const hasBicarb = () => hasDrug("sodium bicarbonate","ไบคาร์บ","nahco3","alkali");
  const hasBinder = () => hasDrug("phosphate binder","calcium carbonate","sevelamer","lanthanum","binder");
  const hasAntiHTN = () => hasDrug("acei","arb","ccb","amlodipine","felodipine","nifedipine","diltiazem","verapamil","beta-blocker","metoprolol","carvedilol","atenolol","bisoprolol","nebivolol","enalapril","losartan","valsartan","candesartan","furosemide","hydrochlorothiazide","indapamide","doxazosin","hydralazine","clonidine");
  const hasSGLT2drug = () => hasDrug("sglt2","dapagliflozin","empagliflozin","canagliflozin");

  // ---------- 6. Lab-triggered alerts ----------
  const hbV = parseFloat(hb), hco3V = parseFloat(hco3), phosV = parseFloat(phos), caV = parseFloat(ca);
  const sbpV = parseFloat(bpSys), dbpV = parseFloat(bpDia), uacrV = parseFloat(uacr);

  // Anemia of CKD: Hb < 10 และยังไม่ได้รักษา (ESA/Iron)
  if (!isNaN(hbV) && hbV < 10 && !hasESAorIron()) {
    addFinding({ sev: hbV < 9 ? SEV.HIGH : SEV.MED,
      msg:`Hb=${hb} g/dL (<10) — อาจเป็น anemia of CKD ที่ยังไม่ได้รักษา`,
      rec:"ประเมิน iron studies (ferritin, TSAT); พิจารณา iron supplement และ/หรือ ESA ตาม KDIGO; ปรึกษาแพทย์",
      drpKey:DRPK.omission, drugs:[], id:"lab_anemia" });
  }
  // Hyperkalemia: K > 5.5 ร่วมยาเพิ่ม K
  if (!isNaN(kVal) && kVal > 5.5 && (hasACEIARB() || hasKsparing())) {
    addFinding({ sev:SEV.HIGH,
      msg:`⚠️ K⁺=${k} mmol/L (>5.5) ร่วมกับยาเพิ่มโพแทสเซียม (ACEI/ARB/K-sparing) — hyperkalemia เสี่ยงสูง`,
      rec:"ทบทวน/หยุดยาที่เพิ่ม K⁺; พิจารณา K-binder; ตรวจ ECG; ติดตาม K⁺ ใกล้ชิด; ปรึกษาแพทย์ด่วน",
      drpKey:DRPK.electrolyte, drugs:[], id:"lab_hyperk" });
  }
  // Metabolic acidosis: HCO3 < 22 และไม่มี alkali
  if (!isNaN(hco3V) && hco3V < 22 && !hasBicarb()) {
    addFinding({ sev: hco3V < 18 ? SEV.HIGH : SEV.MED,
      msg:`HCO₃⁻=${hco3} mEq/L (<22) — metabolic acidosis ที่ยังไม่ได้รักษา`,
      rec:"พิจารณา Sodium bicarbonate เพื่อคุม HCO₃⁻ 22-24 (KDIGO); ชะลอ CKD progression; ปรึกษาแพทย์",
      drpKey:DRPK.omission, drugs:[], id:"lab_acidosis" });
  }
  // Hyperphosphatemia: PO4 > 1.78 mmol/L (≈5.5 mg/dL) และไม่มี binder
  if (!isNaN(phosV) && phosV > 1.78 && !hasBinder()) {
    addFinding({ sev:SEV.MED,
      msg:`Phosphate=${phos} mmol/L (>1.78) — hyperphosphatemia ที่ยังไม่ได้รักษา`,
      rec:"แนะนำจำกัด phosphate ในอาหาร; พิจารณา phosphate binder (กินพร้อมอาหาร); ปรึกษาแพทย์",
      drpKey:DRPK.omission, drugs:[], id:"lab_phosphate" });
  }
  // Hypercalcemia + Ca-based binder/active Vit D
  if (!isNaN(caV) && caV > 2.6 && hasDrug("calcium carbonate","calcitriol","alfacalcidol","paricalcitol")) {
    addFinding({ sev:SEV.MED,
      msg:`Ca=${ca} mmol/L (สูง) ร่วมกับ Ca-based binder / active Vit D — เสี่ยง vascular calcification`,
      rec:"ลด/หยุด Ca-based binder; เปลี่ยนเป็น non-Ca binder (sevelamer); ทบทวน active Vit D",
      drpKey:DRPK.electrolyte, drugs:[], id:"lab_hyperca" });
  }
  // Uncontrolled BP > 130/80 และไม่มียาลดความดัน
  if (((!isNaN(sbpV) && sbpV > 130) || (!isNaN(dbpV) && dbpV > 80)) && !hasAntiHTN()) {
    addFinding({ sev:SEV.MED,
      msg:`BP ${bpSys||"?"}/${bpDia||"?"} mmHg (>130/80) — ความดันยังไม่ถึงเป้า แต่ไม่มียาลดความดันในรายการ`,
      rec:"พิจารณาเริ่มยาลดความดัน (ACEI/ARB first-line ถ้ามี albuminuria) ตาม KDIGO 2024 เป้า <120 SBP",
      drpKey:DRPK.omission, drugs:[], id:"lab_bp_untreated" });
  }

  // ---------- 7. Omission detection (ยาที่ควรได้รับ) ----------
  // Proteinuria/albuminuria + ไม่มี ACEI/ARB
  const hasProteinuria = (!isNaN(uacrV) && uacrV >= 30);
  if (hasProteinuria && !hasACEIARB()) {
    addFinding({ sev:SEV.MED,
      msg:`มี albuminuria (UACR=${uacr} mg/g ≥30) แต่ไม่มี ACEI/ARB — ขาด renoprotection หลัก`,
      rec:"พิจารณาเริ่ม ACEI หรือ ARB (ลด albuminuria, ชะลอ CKD) ถ้าไม่มีข้อห้าม; ติดตาม K⁺/Scr",
      drpKey:DRPK.omission, drugs:[], id:"omit_acei_proteinuria" });
  }
  // CKD G3+ + DM + ไม่มี SGLT2i
  if (ckdNum >= 3 && hasDM && !hasSGLT2drug() && !isNaN(eg) && eg >= 20) {
    addFinding({ sev:SEV.LOW,
      msg:"CKD G3+ ร่วมเบาหวาน แต่ไม่มี SGLT2 inhibitor — ขาดยาที่ลด CKD progression (DAPA-CKD/CREDENCE)",
      rec:"พิจารณา SGLT2i (dapagliflozin/empagliflozin) ถ้า eGFR≥20 และไม่มีข้อห้าม ตาม KDIGO 2024",
      drpKey:DRPK.omission, drugs:[], id:"omit_sglt2_dm" });
  }
  // Sort by severity
  const order = { HIGH:0, MEDIUM:1, LOW:2 };
  findings.sort((a,b) => (order[a.sev]||2) - (order[b.sev]||2));

  const suggestedDrps = [...new Set(findings.map((f) => f.drpKey).filter(Boolean))];
  const hasHigh = findings.some((f) => f.sev === SEV.HIGH);
  const hasMed  = findings.some((f) => f.sev === SEV.MEDIUM);
  const riskLevel = hasHigh ? "HIGH" : hasMed ? "MEDIUM" : findings.length ? "LOW" : null;

  return { findings, suggestedDrps, riskLevel, count: findings.length };
}

const DRP_SEV_META = {
  HIGH:   { color:"#b91c1c", bg:"#fef2f2", border:"#fca5a5", label:"เสี่ยงสูง" },
  MEDIUM: { color:"#b45309", bg:"#fffbeb", border:"#fcd34d", label:"ระวัง" },
  LOW:    { color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe", label:"แจ้งเตือน" },
};

/* =========================================================================
   generateCounselingNote — สังเคราะห์คำแนะนำผู้ป่วยภาษาไทยจากผล analyzeDRPs
   รับ findings (จาก analyzeDRPs) → ข้อความ bullet พร้อมใช้ในช่อง counseling
   ========================================================================= */
function generateCounselingNote(findings = [], opts = {}) {
  if (!Array.isArray(findings) || !findings.length) return "";
  // จัดกลุ่มตามความรุนแรง แล้วแปลง rec เป็น bullet โดยตัดความซ้ำ
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...findings].sort((a, b) => (order[a.sev] || 2) - (order[b.sev] || 2));
  const seen = new Set();
  const lines = [];
  sorted.forEach((f) => {
    const text = (f.rec || f.msg || "").trim();
    if (!text) return;
    const key = text.slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    const drugTag = (f.drugs && f.drugs.length) ? `${f.drugs.join(" + ")}: ` : "";
    const mark = f.sev === "HIGH" ? "• ⚠️ " : "• ";
    lines.push(`${mark}${drugTag}${text}`);
  });
  if (!lines.length) return "";
  const header = "📋 คำแนะนำสำหรับผู้ป่วย (สร้างอัตโนมัติ — โปรดทบทวนก่อนใช้)";
  const footer = opts.followUp ? `\n• นัดติดตาม/ตรวจแล็บครั้งหน้า: ${opts.followUp}` : "";
  return [header, ...lines].join("\n") + footer;
}

/* =========================================================================
   diffMedLists — เปรียบเทียบรายการยา 2 นัด (prev → current)
   คืน { added:[], stopped:[], changed:[{drug, from, to}], unchanged:n }
   จับคู่ด้วยชื่อยา (case-insensitive, ผ่าน lookupDrug ถ้ามี)
   ========================================================================= */
function diffMedLists(prevMeds = [], curMeds = []) {
  const norm = (n) => {
    if (!n) return "";
    const info = (typeof lookupDrug === "function") ? lookupDrug(n) : null;
    return (info ? info.name : n).trim().toLowerCase();
  };
  const valid = (arr) => (arr || []).filter((m) => m && m.drug && m.drug.trim());
  const prev = valid(prevMeds), cur = valid(curMeds);
  const prevMap = new Map(), curMap = new Map();
  prev.forEach((m) => prevMap.set(norm(m.drug), m));
  cur.forEach((m) => curMap.set(norm(m.drug), m));

  const added = [], stopped = [], changed = [];
  let unchanged = 0;
  cur.forEach((m) => {
    const k = norm(m.drug);
    if (!prevMap.has(k)) { added.push(m); return; }
    const p = prevMap.get(k);
    const ps = (p.strength || "").trim(), cs = (m.strength || "").trim();
    const pd = (p.dose || `${p.qtyPerDose || ""}x${p.freqPerDay || ""}`).trim();
    const cd = (m.dose || `${m.qtyPerDose || ""}x${m.freqPerDay || ""}`).trim();
    if (ps !== cs || pd !== cd) {
      changed.push({ drug: m.drug, from: `${ps} ${pd}`.trim(), to: `${cs} ${cd}`.trim() });
    } else unchanged++;
  });
  prev.forEach((m) => { if (!curMap.has(norm(m.drug))) stopped.push(m); });
  return { added, stopped, changed, unchanged };
}

/* =========================================================================
   checkDDI(drugList) — ตรวจ DDI จาก list ชื่อยา
   returns: [{drugA, drugB, severity:"major"|"moderate"|"minor", message}]
   ========================================================================= */
const DDI_SIMPLE = [
  /* Warfarin combinations */
  { a:["warfarin"], b:["aspirin","ibuprofen","naproxen","diclofenac","nsaid","celecoxib"], severity:"major", message:"Warfarin + NSAID/Aspirin — เพิ่มความเสี่ยงเลือดออกรุนแรง ควรหลีกเลี่ยง ถ้าจำเป็นใช้ Aspirin ขนาดต่ำ 81-100 mg และติดตาม INR" },
  { a:["warfarin"], b:["amiodarone"], severity:"major", message:"Warfarin + Amiodarone — Amiodarone ยับยั้ง CYP2C9 ทำให้ INR สูงมาก เสี่ยงเลือดออก ควรลด Warfarin dose 30-50% และติดตาม INR ทุกสัปดาห์" },
  { a:["warfarin"], b:["clarithromycin","erythromycin","azithromycin"], severity:"major", message:"Warfarin + Macrolide antibiotic — เพิ่ม INR ติดตาม INR ภายใน 3-5 วัน ขณะใช้ยาปฏิชีวนะ" },
  { a:["warfarin"], b:["ciprofloxacin","levofloxacin","fluoroquinolone"], severity:"moderate", message:"Warfarin + Fluoroquinolone — เพิ่ม INR ปานกลาง ควรติดตาม INR ระหว่างใช้ยาและหลังหยุดยา 5-7 วัน" },
  /* ACEI/ARB + K-sparing */
  { a:["enalapril","lisinopril","ramipril","captopril","perindopril","imidapril","losartan","valsartan","candesartan","irbesartan","telmisartan","olmesartan","acei","arb"], b:["spironolactone","eplerenone","amiloride"], severity:"major", message:"ACEI/ARB + K-sparing diuretic — เพิ่มความเสี่ยง Hyperkalemia อย่างมากใน CKD ควรติดตาม K+ ทุก 1-2 สัปดาห์แรก และหลีกเลี่ยงถ้า K+ > 5.0 หรือ eGFR < 30" },
  /* ACEI + ARB dual blockade */
  { a:["enalapril","lisinopril","ramipril","captopril","perindopril","imidapril"], b:["losartan","valsartan","candesartan","irbesartan","telmisartan","olmesartan"], severity:"major", message:"ACEI + ARB Dual blockade — เพิ่มความเสี่ยง Hyperkalemia และ AKI อย่างมาก ไม่แนะนำให้ใช้ร่วมกัน (ONTARGET trial)" },
  /* Metformin + contrast */
  { a:["metformin"], b:["contrast","iodinated","iohexol","iodixanol","สารทึบรังสี"], severity:"major", message:"Metformin + Iodinated contrast — เสี่ยง Contrast-induced AKI ทำให้ Metformin สะสม → Lactic acidosis ควรหยุด Metformin ก่อนฉีดสาร 48 ชม. และตรวจ Scr ก่อนเริ่มยาใหม่" },
  /* Digoxin + Amiodarone */
  { a:["digoxin"], b:["amiodarone"], severity:"major", message:"Digoxin + Amiodarone — Amiodarone เพิ่มระดับ Digoxin 70-100% เสี่ยง Digoxin toxicity ควรลด Digoxin dose 50% เมื่อเริ่ม Amiodarone และติดตาม ECG กับ Digoxin level" },
  /* Fluoroquinolone + Antacids */
  { a:["ciprofloxacin","levofloxacin","fluoroquinolone"], b:["calcium carbonate","aluminum hydroxide","magnesium","antacid","sevelamer","lanthanum","แคลเซียม"], severity:"moderate", message:"Fluoroquinolone + Antacid/Mineral — Antacid ลดการดูดซึม Fluoroquinolone ได้ถึง 50-90% ควรรับประทาน Fluoroquinolone ก่อนอย่างน้อย 2 ชม. หรือ 6 ชม.หลัง" },
  /* Statin + Amiodarone (myopathy) */
  { a:["simvastatin","atorvastatin","rosuvastatin","statin"], b:["amiodarone"], severity:"major", message:"Statin + Amiodarone — Amiodarone เพิ่มระดับ Statin เสี่ยง Myopathy/Rhabdomyolysis โดยเฉพาะ Simvastatin max dose 20mg ถ้าใช้ร่วม Amiodarone ควรพิจารณาเปลี่ยนเป็น Rosuvastatin หรือ Pravastatin" },
  /* NSAIDs + Diuretics */
  { a:["ibuprofen","naproxen","diclofenac","celecoxib","nsaid"], b:["furosemide","torsemide","hydrochlorothiazide","indapamide"], severity:"major", message:"NSAID + Diuretic — NSAID ลดประสิทธิภาพยาขับปัสสาวะและเพิ่มเสี่ยง AKI (Triple Whammy ถ้ามี ACEI/ARB ด้วย) ควรหยุด NSAID และใช้ Paracetamol แทน" },
  /* NSAIDs + ACEI (triple whammy) */
  { a:["ibuprofen","naproxen","diclofenac","celecoxib","nsaid"], b:["enalapril","lisinopril","ramipril","losartan","valsartan","candesartan"], severity:"major", message:"NSAID + ACEI/ARB — Triple Whammy ใน CKD: เสี่ยง AKI สูงมาก ลด GFR, เพิ่ม K+, ลดประสิทธิภาพ Renoprotection ควรหยุด NSAID ทันทีและติดตาม Scr" },
  /* Allopurinol + Azathioprine */
  { a:["allopurinol"], b:["azathioprine","6-mercaptopurine"], severity:"major", message:"Allopurinol + Azathioprine — Allopurinol ยับยั้ง Xanthine oxidase ทำให้ Azathioprine สะสม เสี่ยง Bone marrow suppression รุนแรง ควรลด Azathioprine dose 25-33% หรือหลีกเลี่ยงการใช้ร่วมกัน" },
  /* Cyclosporine + Statins */
  { a:["cyclosporine","tacrolimus"], b:["simvastatin","atorvastatin","rosuvastatin","statin"], severity:"major", message:"Cyclosporine/Tacrolimus + Statin — เพิ่มระดับ Statin อย่างมาก เสี่ยง Myopathy/Rhabdomyolysis ควรหลีกเลี่ยง Simvastatin ใช้ Pravastatin ขนาดต่ำแทน (น้อย interaction)" },
  /* Colchicine + Clarithromycin */
  { a:["colchicine"], b:["clarithromycin","erythromycin"], severity:"major", message:"Colchicine + Clarithromycin — Clarithromycin เพิ่มระดับ Colchicine อย่างมาก เสี่ยงพิษรุนแรงถึงแก่ชีวิต ควรหลีกเลี่ยงการใช้ร่วมกัน เปลี่ยน antibiotic หรือลด Colchicine 0.5mg วันเว้นวัน" },
  /* Digoxin + Loop diuretics (hypokalemia) */
  { a:["digoxin"], b:["furosemide","torsemide","hydrochlorothiazide"], severity:"major", message:"Digoxin + Loop/Thiazide diuretic — ยาขับปัสสาวะทำให้ K+ ลด เพิ่มความเป็นพิษของ Digoxin ควรติดตาม K+ และ Digoxin level เป้าหมาย K+ > 4.0 mmol/L" },
  /* Statin + Gemfibrozil */
  { a:["simvastatin","atorvastatin","rosuvastatin","statin"], b:["gemfibrozil"], severity:"major", message:"Statin + Gemfibrozil — เสี่ยง Rhabdomyolysis รุนแรง ไม่ควรใช้ร่วมกัน ควรเปลี่ยนเป็น Fenofibrate (ปลอดภัยกว่า)" },
  /* TMP-SMX + ACEI/ARB */
  { a:["trimethoprim","tmp-smx","sulfamethoxazole","co-trimoxazole"], b:["enalapril","lisinopril","ramipril","losartan","valsartan"], severity:"major", message:"TMP-SMX + ACEI/ARB — TMP บล็อก Tubular K+ secretion ร่วมกับ ACEI/ARB เสี่ยง Hyperkalemia รุนแรงใน CKD ควรติดตาม K+ ภายใน 3-5 วัน" },
];

function checkDDI(drugList) {
  if (!drugList || drugList.length < 2) return [];
  const names = drugList.map(d => (d.name || d || "").toLowerCase().trim()).filter(Boolean);
  const results = [];
  const seen = new Set();
  DDI_SIMPLE.forEach(rule => {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const na = names[i], nb = names[j];
        const aMatchA = rule.a.some(p => na.includes(p.toLowerCase()));
        const bMatchB = rule.b.some(p => nb.includes(p.toLowerCase()));
        const aMatchB = rule.b.some(p => na.includes(p.toLowerCase()));
        const bMatchA = rule.a.some(p => nb.includes(p.toLowerCase()));
        if ((aMatchA && bMatchB) || (aMatchB && bMatchA)) {
          const key = rule.severity + "|" + [drugList[i].name||names[i], drugList[j].name||names[j]].sort().join("+");
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ drugA: drugList[i].name||names[i], drugB: drugList[j].name||names[j], severity: rule.severity, message: rule.message });
          }
        }
      }
    }
  });
  return results;
}

/* =========================================================================
   checkDoseAdjustment(drugName, egfr) — ตรวจว่ายาต้องปรับขนาดตาม eGFR หรือไม่
   returns: null | {level:"caution"|"reduce"|"avoid", message:string}
   ========================================================================= */
const DOSE_ADJ_DB = [
  { drugs:["metformin"], checks:[
    { egfrMax:30, level:"avoid", message:"Metformin: ห้ามใช้ eGFR < 30 เสี่ยง Lactic acidosis ควรหยุดยาและปรึกษาแพทย์เปลี่ยนยา" },
    { egfrMax:45, level:"caution", message:"Metformin: ระวัง eGFR 30-45 ลด dose เป็นสูงสุด 1,000 mg/วัน และติดตาม Scr ทุก 3 เดือน" },
  ]},
  { drugs:["gabapentin"], checks:[
    { egfrMax:30, level:"avoid", message:"Gabapentin: ลด dose มาก eGFR < 30: 300 mg ทุกวัน หรือ 300 mg วันเว้นวัน ถ้า eGFR < 15" },
    { egfrMax:60, level:"reduce", message:"Gabapentin: ลด dose eGFR 30-59: สูงสุด 300 mg วันละ 2 ครั้ง เสี่ยง sedation เพิ่มใน uremia" },
  ]},
  { drugs:["pregabalin"], checks:[
    { egfrMax:30, level:"avoid", message:"Pregabalin: ลดขนาด 75% ถ้า eGFR < 30 สูงสุด 75-150 mg/วัน เสี่ยง sedation สูง" },
    { egfrMax:60, level:"reduce", message:"Pregabalin: ลดขนาด 50% ถ้า eGFR 30-59 เพิ่มความเสี่ยง sedation และ dizziness ใน CKD" },
  ]},
  { drugs:["allopurinol"], checks:[
    { egfrMax:30, level:"avoid", message:"Allopurinol: ลด dose เหลือ 50-100 mg/วัน ถ้า eGFR < 30 เสี่ยง SJS รุนแรงขึ้น (HLA-B*5801 ในคนไทย)" },
    { egfrMax:60, level:"reduce", message:"Allopurinol: ลด dose เหลือ 100-200 mg/วัน ถ้า eGFR 30-59 ติดตาม urate level และ skin reaction" },
  ]},
  { drugs:["spironolactone","eplerenone"], checks:[
    { egfrMax:30, level:"avoid", message:"Spironolactone/Eplerenone: ห้ามใช้ eGFR < 30 เสี่ยง Hyperkalemia รุนแรง ควรเปลี่ยนเป็น Furosemide" },
  ]},
  { drugs:["colchicine"], checks:[
    { egfrMax:30, level:"avoid", message:"Colchicine: ห้ามใช้ eGFR < 30 เสี่ยง Neuromyopathy สะสม ใช้ Prednisolone แทนใน acute gout" },
    { egfrMax:50, level:"reduce", message:"Colchicine: ลด dose เหลือสูงสุด 0.5 mg วันละ 2 ครั้ง ถ้า eGFR 30-50" },
  ]},
  { drugs:["metoclopramide"], checks:[
    { egfrMax:40, level:"reduce", message:"Metoclopramide: ลด dose 50% ถ้า eGFR < 40 เสี่ยง EPS (Extrapyramidal symptoms) สูงใน uremia" },
  ]},
  { drugs:["enoxaparin","lmwh"], checks:[
    { egfrMax:30, level:"reduce", message:"Enoxaparin/LMWH: ปรับเป็น 1 mg/kg ทุก 24h ถ้า eGFR < 30 ติดตาม anti-Xa level พิจารณาเปลี่ยนเป็น UFH" },
  ]},
  { drugs:["digoxin"], checks:[
    { egfrMax:30, level:"avoid", message:"Digoxin: ลด dose เหลือ 0.0625 mg/วัน ถ้า eGFR < 30 Digoxin สะสมมากใน CKD ติดตาม Digoxin level 0.5-0.9 ng/mL" },
    { egfrMax:50, level:"reduce", message:"Digoxin: ลด dose เหลือ 0.125 mg/วัน ถ้า eGFR 30-50 ระวัง toxicity ใน hypokalemia" },
  ]},
  { drugs:["tramadol"], checks:[
    { egfrMax:30, level:"avoid", message:"Tramadol: ห้ามใช้ eGFR < 30 metabolite M1 สะสม เสี่ยง Seizure และ CNS toxicity ใช้ Paracetamol แทน" },
    { egfrMax:60, level:"reduce", message:"Tramadol: ยืดระยะห่างการให้ยา ถ้า eGFR 30-60 เป็น q8-12h แทน q4-6h" },
  ]},
  { drugs:["ranitidine","famotidine"], checks:[
    { egfrMax:50, level:"reduce", message:"Ranitidine/Famotidine: ลด dose 50% ถ้า eGFR < 50 Ranitidine เพิ่ม Scr ปลอม (ลด tubular secretion)" },
  ]},
  { drugs:["bisoprolol","atenolol"], checks:[
    { egfrMax:30, level:"reduce", message:"Bisoprolol/Atenolol: ลด dose ถ้า eGFR < 30 Atenolol ต้องปรับเป็น 25 mg/วัน หรือ q48h" },
  ]},
  { drugs:["acyclovir","valacyclovir"], checks:[
    { egfrMax:30, level:"avoid", message:"Acyclovir/Valacyclovir: ลด dose ยา 50% ถ้า eGFR < 30 เสี่ยง Crystalline nephropathy และ Neurotoxicity" },
    { egfrMax:50, level:"reduce", message:"Acyclovir/Valacyclovir: ลด dose หรือยืดระยะห่าง ถ้า eGFR 30-50 ให้ hydration ดี" },
  ]},
  { drugs:["nitrofurantoin"], checks:[
    { egfrMax:30, level:"avoid", message:"Nitrofurantoin: ห้ามใช้ eGFR < 30 ยาไม่ออกฤทธิ์ใน urine และเป็น Peripheral neuropathy ได้" },
  ]},
  { drugs:["dabigatran"], checks:[
    { egfrMax:30, level:"avoid", message:"Dabigatran: ห้ามใช้ eGFR < 30 80% ขับทางไต เสี่ยง Accumulation และเลือดออกรุนแรง ใช้ Apixaban แทน" },
  ]},
];

function checkDoseAdjustment(drugName, egfr) {
  if (!drugName || !egfr) return null;
  const dn = drugName.toLowerCase().trim();
  const eg = parseFloat(egfr);
  if (isNaN(eg)) return null;
  for (const entry of DOSE_ADJ_DB) {
    if (entry.drugs.some(d => dn.includes(d.toLowerCase()))) {
      for (const chk of entry.checks) {
        if (eg < chk.egfrMax) return { level: chk.level, message: chk.message };
      }
    }
  }
  return null;
}

/* =========================================================================
   checkContraindicated(drugName, egfr) — ตรวจยาที่ห้ามใช้หรือระวังใน CKD
   returns: null | {level:"contraindicated"|"caution", message:string}
   ========================================================================= */
const CONTRA_DB = [
  { drugs:["ibuprofen","naproxen","diclofenac","celecoxib","mefenamic","indomethacin","meloxicam","piroxicam","etoricoxib","nimesulide","nsaid"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"NSAID: ห้ามใช้ eGFR < 30 ทำให้ GFR ลดเฉียบพลัน AKI Hyperkalemia และ fluid retention ในผู้ป่วย CKD" },
      { egfrMax:60, level:"caution", message:"NSAID: ระวัง eGFR 30-60 ลดการไหลเวียนเลือดไต เสี่ยง AKI ใช้ Paracetamol แทนถ้าเป็นไปได้" },
    ]
  },
  { drugs:["metformin"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Metformin: ห้ามใช้ eGFR < 30 เสี่ยง Lactic acidosis รุนแรง ต้องหยุดยาทันที" },
    ]
  },
  { drugs:["nitrofurantoin"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Nitrofurantoin: ห้ามใช้ eGFR < 30 ยาไม่ได้ผลเพราะไม่สะสมใน urine และเสี่ยง Peripheral neuropathy" },
    ]
  },
  { drugs:["spironolactone","eplerenone","amiloride"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"K-sparing diuretic: ห้ามใช้ eGFR < 30 เสี่ยง Hyperkalemia รุนแรงจนหัวใจหยุดเต้นได้" },
    ]
  },
  { drugs:["dabigatran"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Dabigatran: ห้ามใช้ eGFR < 30 ยาขับออกทางไต 80% สะสมมาก เสี่ยงเลือดออกรุนแรง ใช้ Apixaban แทน" },
    ]
  },
  { drugs:["magnesium","แมกนีเซียม","magnesium hydroxide","milk of magnesia"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Magnesium antacid: ห้ามใช้ eGFR < 30 Mg สะสมได้ง่ายใน CKD เสี่ยง Hypermagnesemia จนหัวใจหยุดเต้น" },
    ]
  },
  { drugs:["aluminum hydroxide","aluminum"],
    checks:[
      { egfrMax:60, level:"caution", message:"Aluminum antacid: ระวัง CKD ทุก stage Al สะสมทำให้ Encephalopathy, Osteomalacia ใช้เฉพาะระยะสั้นฉุกเฉิน" },
    ]
  },
  { drugs:["colchicine"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Colchicine: ห้ามใช้ eGFR < 30 เสี่ยง Neuromyopathy สะสม ใช้ Prednisolone แทน" },
    ]
  },
  { drugs:["glibenclamide","daonil"],
    checks:[
      { egfrMax:60, level:"contraindicated", message:"Glibenclamide: ห้ามใช้ใน CKD ทุก stage Active metabolite สะสม เสี่ยง Hypoglycemia รุนแรง เปลี่ยน Gliclazide หรือ Linagliptin" },
    ]
  },
  { drugs:["tramadol"],
    checks:[
      { egfrMax:30, level:"contraindicated", message:"Tramadol: ห้ามใช้ eGFR < 30 Metabolite M1 สะสม เสี่ยง Seizure และ CNS toxicity ใช้ Paracetamol แทน" },
    ]
  },
];

function checkContraindicated(drugName, egfr) {
  if (!drugName || !egfr) return null;
  const dn = drugName.toLowerCase().trim();
  const eg = parseFloat(egfr);
  if (isNaN(eg)) return null;
  for (const entry of CONTRA_DB) {
    if (entry.drugs.some(d => dn.includes(d.toLowerCase()))) {
      for (const chk of entry.checks) {
        if (eg < chk.egfrMax) return { level: chk.level, message: chk.message };
      }
    }
  }
  return null;
}

Object.assign(window, { analyzeDRPs, DRP_SEV_META, SEV, DRPK, dailyDoseMg, parseStrengthNum, unitsPerDayOf, fmtDose, generateCounselingNote, diffMedLists, checkDDI, checkDoseAdjustment, checkContraindicated });
