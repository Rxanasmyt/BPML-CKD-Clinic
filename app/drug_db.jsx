/* =========================================================================
   drug_db.jsx — ฐานข้อมูลยาคลินิก CKD
   อ้างอิง: KDIGO CKD Guideline 2024, Thai National List of Essential Medicines (NLEM),
            UpToDate/Micromedex (principles), KiDNEY Drug Database, DAPA-CKD/CREDENCE Trials
   flags: nephrotoxic | contra (ห้ามใช้/ระวังมากใน CKD stage ≥3-4) | renal (ต้องปรับขนาด) | k (เสี่ยง K⁺)
   ========================================================================= */

const DRUG_DB = [
  /* ===== ACEI ===== */
  { name:"Enalapril", cls:"ACEI", strengths:["5 mg","10 mg","20 mg"], flags:["renal","k"],
    note:"ลด dose เมื่อ eGFR<30; ติดตาม K⁺ และ Scr ทุกนัด; ห้ามร่วมกับ ARB" },
  { name:"Lisinopril", cls:"ACEI", strengths:["5 mg","10 mg","20 mg"], flags:["renal","k"],
    note:"ปรับขนาด: eGFR 10-30 → เริ่ม 2.5-5 mg/day; หลีกเลี่ยง eGFR<10" },
  { name:"Ramipril", cls:"ACEI", strengths:["2.5 mg","5 mg","10 mg"], flags:["renal","k"],
    note:"eGFR 10-30 → 1.25 mg/day; renoprotective ใน DM nephropathy" },
  { name:"Captopril", cls:"ACEI", strengths:["12.5 mg","25 mg","50 mg"], flags:["renal","k"],
    note:"Short-acting; ลดความถี่ใน renal impairment; กิน 1h ก่อนอาหาร" },
  { name:"Perindopril", cls:"ACEI", strengths:["2 mg","4 mg","8 mg"], flags:["renal","k"],
    note:"Max 2 mg/day ถ้า eGFR<30; ออกฤทธิ์นาน สะดวก 1 ครั้ง/วัน" },
  { name:"Imidapril", cls:"ACEI", strengths:["5 mg","10 mg"], flags:["renal","k"],
    note:"ปรับ dose ใน CKD 3-5; ติดตาม K⁺" },

  /* ===== ARB ===== */
  { name:"Losartan", cls:"ARB", strengths:["25 mg","50 mg","100 mg"], flags:["k"],
    note:"First-line ใน diabetic nephropathy; ไม่ต้องปรับ dose; ลด proteinuria" },
  { name:"Valsartan", cls:"ARB", strengths:["40 mg","80 mg","160 mg","320 mg"], flags:["k"],
    note:"ไม่ต้องปรับ dose ใน CKD; ติดตาม K⁺ และ Scr" },
  { name:"Candesartan", cls:"ARB", strengths:["4 mg","8 mg","16 mg","32 mg"], flags:["k","renal"],
    note:"ระวัง eGFR<30; หลีกเลี่ยง eGFR<15" },
  { name:"Irbesartan", cls:"ARB", strengths:["75 mg","150 mg","300 mg"], flags:["k"],
    note:"ไม่ต้องปรับ dose; ใช้ได้ใน mild-moderate CKD" },
  { name:"Telmisartan", cls:"ARB", strengths:["20 mg","40 mg","80 mg"], flags:["k"],
    note:"ไม่ต้องปรับ dose; ออกฤทธิ์นาน 24h; ใช้ได้ใน CKD" },
  { name:"Olmesartan", cls:"ARB", strengths:["10 mg","20 mg","40 mg"], flags:["k"],
    note:"ไม่ต้องปรับ dose; ห้ามร่วมกับ ACEI หรือ aliskiren" },

  /* ===== SGLT2 inhibitors (สำคัญมากใน CKD) ===== */
  { name:"Dapagliflozin", cls:"SGLT2 inhibitor", strengths:["5 mg","10 mg"], flags:["renal"],
    note:"DAPA-CKD: ลด progression ใน CKD; ใช้ได้ eGFR≥25; 10 mg/day" },
  { name:"Empagliflozin", cls:"SGLT2 inhibitor", strengths:["10 mg","25 mg"], flags:["renal"],
    note:"EMPA-KIDNEY: cardio-renal benefit; เริ่มได้ eGFR≥20; glycemic ↓ ที่ eGFR≥45" },
  { name:"Canagliflozin", cls:"SGLT2 inhibitor", strengths:["100 mg","300 mg"], flags:["renal"],
    note:"CREDENCE: CKD+DM benefit; ใช้เพื่อ renoprotection ที่ eGFR≥30" },

  /* ===== CCB ===== */
  { name:"Amlodipine", cls:"CCB (DHP)", strengths:["2.5 mg","5 mg","10 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; First-line BP ใน CKD; ไม่มี renal effect โดยตรง" },
  { name:"Felodipine", cls:"CCB (DHP)", strengths:["2.5 mg","5 mg","10 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ใช้แทน amlodipine ได้" },
  { name:"Nifedipine CR", cls:"CCB (DHP)", strengths:["30 mg","60 mg"], flags:[],
    note:"ใช้ SR/CR เท่านั้น; ห้ามใช้ immediate-release ใน CKD hypertension crisis" },
  { name:"Diltiazem", cls:"CCB (Non-DHP)", strengths:["60 mg","90 mg","120 mg","180 mg SR"], flags:[],
    note:"ลด proteinuria ร่วมกับ ACEI/ARB; ไม่ต้องปรับ dose; ระวัง HR" },
  { name:"Verapamil", cls:"CCB (Non-DHP)", strengths:["40 mg","80 mg","120 mg SR"], flags:["renal"],
    note:"ลด dose ใน severe CKD; ท้องผูกเป็น side effect สำคัญ" },

  /* ===== Beta-blockers ===== */
  { name:"Metoprolol succinate", cls:"Beta-blocker (β1)", strengths:["25 mg SR","50 mg SR","100 mg SR","200 mg SR"], flags:[],
    note:"ไม่ต้องปรับ dose; Preferred BB ใน CKD+HF; กินวันละครั้ง" },
  { name:"Metoprolol tartrate", cls:"Beta-blocker (β1)", strengths:["25 mg","50 mg","100 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; Short-acting; กิน 2-3 ครั้ง/วัน" },
  { name:"Carvedilol", cls:"Alpha+Beta-blocker", strengths:["3.125 mg","6.25 mg","12.5 mg","25 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; Cardioprotective ใน CKD+HF; เริ่ม dose ต่ำ" },
  { name:"Atenolol", cls:"Beta-blocker (β1)", strengths:["25 mg","50 mg","100 mg"], flags:["renal"],
    note:"Renal excretion: eGFR 15-35 → 50 mg/day; <15 → 25 mg/day หรือ q48h" },
  { name:"Bisoprolol", cls:"Beta-blocker (β1)", strengths:["2.5 mg","5 mg","10 mg"], flags:["renal"],
    note:"ลด dose ถ้า eGFR<20; Max 10 mg/day; ไม่มี ISA" },
  { name:"Nebivolol", cls:"Beta-blocker (β1+NO)", strengths:["5 mg"], flags:["renal"],
    note:"ลด dose ใน severe CKD; vasodilatory effect ช่วย BP" },

  /* ===== Diuretics ===== */
  { name:"Furosemide", cls:"Loop diuretic", strengths:["20 mg","40 mg","80 mg","500 mg"], flags:[],
    note:"ต้องใช้ dose สูงขึ้นใน CKD 3-5 (impaired tubular secretion); effective แม้ eGFR ต่ำ" },
  { name:"Torsemide", cls:"Loop diuretic", strengths:["5 mg","10 mg","20 mg"], flags:[],
    note:"Oral bioavailability ดีกว่า furosemide; ไม่ต้องปรับ dose; 1 ครั้ง/วัน" },
  { name:"Bumetanide", cls:"Loop diuretic", strengths:["0.5 mg","1 mg"], flags:[],
    note:"Potent; 1 mg ≈ 40 mg furosemide; ใช้เมื่อ furosemide ไม่ตอบสนอง" },
  { name:"Hydrochlorothiazide", cls:"Thiazide diuretic", strengths:["12.5 mg","25 mg","50 mg"], flags:["renal"],
    note:"ไม่ได้ผลถ้า eGFR<30; เปลี่ยนเป็น loop diuretic; ลด K⁺" },
  { name:"Indapamide", cls:"Thiazide-like diuretic", strengths:["1.5 mg SR","2.5 mg"], flags:["renal"],
    note:"ได้ผลที่ eGFR ต่ำกว่า HCTZ เล็กน้อย; หลีกเลี่ยง eGFR<30" },
  { name:"Chlorthalidone", cls:"Thiazide-like diuretic", strengths:["12.5 mg","25 mg"], flags:["renal"],
    note:"T½ ยาว; ไม่ได้ผลใน eGFR<30 เช่นกัน; ลด K⁺ และ Mg²⁺" },
  { name:"Spironolactone", cls:"K-sparing/MRA", strengths:["25 mg","50 mg","100 mg"], flags:["k","contra"],
    note:"⚠️ AVOID: eGFR<30 หรือ K⁺>5.0 — hyperkalemia อันตราย; ใช้ด้วยความระมัดระวังมาก" },
  { name:"Eplerenone", cls:"K-sparing/MRA (selective)", strengths:["25 mg","50 mg"], flags:["k","contra"],
    note:"⚠️ AVOID eGFR<30; ติดตาม K⁺ ทุก 1-2 สัปดาห์แรก; selective MRA" },
  { name:"Amiloride", cls:"K-sparing diuretic", strengths:["5 mg"], flags:["k","contra"],
    note:"ห้ามใช้ถ้า K⁺>5.0 หรือ eGFR<30; รวม formulation กับ HCTZ บ่อย" },

  /* ===== Vasodilators / Others ===== */
  { name:"Hydralazine", cls:"Direct vasodilator", strengths:["10 mg","25 mg","50 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ใช้ใน resistant HTN; lupus-like syndrome ถ้าใช้นาน" },
  { name:"Minoxidil", cls:"Direct vasodilator", strengths:["2.5 mg","5 mg","10 mg"], flags:[],
    note:"Resistant HTN; ต้องใช้ร่วม beta-blocker + loop diuretic เสมอ" },
  { name:"Doxazosin", cls:"Alpha-1 blocker", strengths:["1 mg","2 mg","4 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ใช้ได้ใน BPH+HTN; orthostatic hypotension" },
  { name:"Clonidine", cls:"Central alpha-2 agonist", strengths:["0.075 mg","0.1 mg","0.15 mg","0.2 mg"], flags:["renal"],
    note:"ปรับ dose ใน severe CKD; rebound HTN ถ้าหยุดกะทันหัน; ใช้ใน dialysis HTN" },
  { name:"Sacubitril/Valsartan", cls:"ARNI (ARB+Neprilysin inhibitor)", strengths:["24/26 mg","49/51 mg","97/103 mg"], flags:["k","renal"],
    note:"HFrEF ใน CKD; ห้ามร่วม ACEI (angioedema); ระวัง K⁺ และ BP ต่ำ" },

  /* ===== DIABETES ===== */
  { name:"Metformin", cls:"Biguanide", strengths:["500 mg","850 mg","1000 mg"], flags:["renal","contra"],
    note:"⚠️ STOP ถ้า eGFR<30 (lactic acidosis risk); ลด dose eGFR 30-45: max 1 g/day" },
  { name:"Gliclazide", cls:"Sulfonylurea (SU)", strengths:["30 mg MR","60 mg MR","80 mg"], flags:["renal"],
    note:"Preferred SU ใน CKD (inactive metabolites); ลด dose ถ้า eGFR<60; ระวัง eGFR<15" },
  { name:"Glipizide", cls:"Sulfonylurea (SU)", strengths:["5 mg","10 mg"], flags:["renal"],
    note:"Short-acting; metabolites inactive → ปลอดภัยกว่า glibenclamide; ระวัง eGFR<50" },
  { name:"Glibenclamide", cls:"Sulfonylurea (SU)", strengths:["5 mg"], flags:["contra"],
    note:"⚠️ AVOID ใน CKD ทุก stage — active metabolite สะสม → hypoglycemia รุนแรง" },
  { name:"Sitagliptin", cls:"DPP-4 inhibitor", strengths:["25 mg","50 mg","100 mg"], flags:["renal"],
    note:"ปรับ dose: eGFR 30-44 → 50 mg/day; <30 → 25 mg/day; ปลอดภัยใน CKD" },
  { name:"Vildagliptin", cls:"DPP-4 inhibitor", strengths:["50 mg"], flags:["renal"],
    note:"eGFR<50 → 50 mg/day (ไม่ใช้ 50 mg BD); ติดตาม LFTs ทุก 3 เดือน" },
  { name:"Saxagliptin", cls:"DPP-4 inhibitor", strengths:["2.5 mg","5 mg"], flags:["renal"],
    note:"eGFR<45 → ลด 2.5 mg/day; ระวัง HF exacerbation" },
  { name:"Linagliptin", cls:"DPP-4 inhibitor", strengths:["5 mg"], flags:[],
    note:"✓ ไม่ต้องปรับ dose — Preferred DPP-4i ใน CKD ทุก stage (biliary excretion)" },
  { name:"Pioglitazone", cls:"Thiazolidinedione (TZD)", strengths:["15 mg","30 mg","45 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ห้ามใน HF (fluid retention) และ osteoporosis; ลด IR" },
  { name:"Liraglutide", cls:"GLP-1 receptor agonist", strengths:["6 mg/mL (FlexPen)"], flags:["renal"],
    note:"ระวัง eGFR<15; GI side effects → dehydration → AKI; cardioprotective" },
  { name:"Semaglutide", cls:"GLP-1 receptor agonist", strengths:["0.25 mg","0.5 mg","1 mg SC","3 mg PO","7 mg PO","14 mg PO"], flags:["renal"],
    note:"FLOW trial (2024): renal benefit; ระวัง GI ใน CKD 4-5; ไม่ต้องปรับ dose SC" },
  { name:"Insulin Regular (RI)", cls:"Insulin (short-acting)", strengths:["100 IU/mL"], flags:["renal"],
    note:"ลด dose 25-50% ใน eGFR<30 (ลด renal insulin degradation); ติดตาม glucose" },
  { name:"Insulin NPH", cls:"Insulin (intermediate)", strengths:["100 IU/mL"], flags:["renal"],
    note:"ระวัง hypoglycemia ใน CKD; ลด dose ถ้า eGFR<30" },
  { name:"Insulin Glargine U-100", cls:"Insulin (basal)", strengths:["100 IU/mL"], flags:["renal"],
    note:"ลด dose ใน eGFR<30; predictable flat profile; หลีกเลี่ยง hypoglycemia" },
  { name:"Insulin Glargine U-300", cls:"Insulin (basal)", strengths:["300 IU/mL"], flags:["renal"],
    note:"ลด hypoglycemia risk กว่า U-100; ใช้ได้ใน CKD; ลด dose ถ้า eGFR<30" },
  { name:"Insulin Degludec", cls:"Insulin (ultra-long basal)", strengths:["100 IU/mL","200 IU/mL"], flags:["renal"],
    note:"T½ ~25h; ลด nocturnal hypoglycemia; ลด dose ใน CKD 4-5" },
  { name:"Insulin Aspart", cls:"Insulin (rapid-acting)", strengths:["100 IU/mL"], flags:["renal"],
    note:"Rapid-acting; กินอาหารแล้วฉีดทันที; ลด dose ใน CKD" },

  /* ===== LIPID-LOWERING ===== */
  { name:"Atorvastatin", cls:"Statin", strengths:["10 mg","20 mg","40 mg","80 mg"], flags:[],
    note:"✓ Preferred statin ใน CKD; ไม่ต้องปรับ dose; SHARP trial รองรับ" },
  { name:"Rosuvastatin", cls:"Statin", strengths:["5 mg","10 mg","20 mg","40 mg"], flags:["renal"],
    note:"Max 10 mg/day ถ้า eGFR<30; SHARP: 10 mg rosuvastatin+10 mg ezetimibe" },
  { name:"Simvastatin", cls:"Statin", strengths:["10 mg","20 mg","40 mg","80 mg"], flags:[],
    note:"ไม่ต้องปรับ dose ใน CKD; หลีกเลี่ยง 80 mg (myopathy risk)" },
  { name:"Pravastatin", cls:"Statin", strengths:["10 mg","20 mg","40 mg"], flags:["renal"],
    note:"ลด dose ถ้า eGFR<30: max 20 mg/day; น้อย drug interactions" },
  { name:"Pitavastatin", cls:"Statin", strengths:["1 mg","2 mg","4 mg"], flags:["renal"],
    note:"Max 2 mg/day ถ้า eGFR<30; น้อย drug interactions; ไม่ผ่าน CYP3A4" },
  { name:"Fluvastatin", cls:"Statin", strengths:["20 mg","40 mg","80 mg XL"], flags:[],
    note:"ไม่ต้องปรับ dose; metabolism hepatic; ใช้ได้ใน CKD" },
  { name:"Ezetimibe", cls:"Cholesterol absorption inhibitor", strengths:["10 mg"], flags:[],
    note:"✓ ไม่ต้องปรับ dose; add-on กับ statin ใน CKD (SHARP protocol)" },
  { name:"Fenofibrate", cls:"Fibrate", strengths:["145 mg","160 mg"], flags:["renal","contra"],
    note:"⚠️ AVOID eGFR<30; เพิ่ม Scr (ลด tubular secretion, ไม่ใช่ true GFR ลด); CKD 3b ใช้ด้วยระวัง" },

  /* ===== GOUT / HYPERURICEMIA ===== */
  { name:"Allopurinol", cls:"Xanthine oxidase inhibitor (XOI)", strengths:["100 mg","300 mg"], flags:["renal"],
    note:"⚠️ ปรับตาม CrCl: CrCl 60-90→200 mg; 30-60→100 mg; <30→50-100 mg; SJS risk สูง HLA-B*5801" },
  { name:"Febuxostat", cls:"XOI (non-purine)", strengths:["40 mg","80 mg","120 mg"], flags:[],
    note:"✓ Preferred XOI ใน CKD; ไม่ต้องปรับ dose ถ้า eGFR≥30; ระวัง CV event" },
  { name:"Colchicine", cls:"Anti-gout", strengths:["0.5 mg","0.6 mg"], flags:["renal","contra"],
    note:"⚠️ AVOID eGFR<30; ลด dose eGFR 30-60: max 0.5 mg BD; neuromyopathy risk" },
  { name:"Benzbromarone", cls:"Uricosuric", strengths:["50 mg","100 mg"], flags:["renal","contra"],
    note:"Ineffective และ toxic ใน eGFR<30; ระวัง urate nephropathy" },
  { name:"Prednisolone", cls:"Corticosteroid", strengths:["5 mg","10 mg","20 mg","30 mg","40 mg"], flags:[],
    note:"ใช้ใน acute gout เมื่อ colchicine/NSAIDs ห้ามใช้; short course 5-7 วัน" },

  /* ===== CKD-SPECIFIC: PHOSPHATE BINDERS ===== */
  { name:"Calcium carbonate", cls:"Phosphate binder (Ca-based)", strengths:["500 mg","1000 mg","1500 mg"], flags:[],
    note:"กินพร้อมอาหาร; ระวัง hypercalcemia และ vascular calcification; Ca×P>55 → เปลี่ยน" },
  { name:"Sevelamer carbonate", cls:"Phosphate binder (non-Ca)", strengths:["800 mg","1600 mg"], flags:[],
    note:"✓ Preferred ถ้ามี hypercalcemia; ลด CV calcification; แพงกว่า Ca-based" },
  { name:"Sevelamer HCl", cls:"Phosphate binder (non-Ca)", strengths:["400 mg","800 mg"], flags:[],
    note:"ระวัง metabolic acidosis (เพิ่ม Cl⁻); เปลี่ยนเป็น carbonate ดีกว่า" },
  { name:"Lanthanum carbonate", cls:"Phosphate binder (non-Ca)", strengths:["500 mg","750 mg","1000 mg"], flags:[],
    note:"เคี้ยวพร้อมอาหาร; potent; ราคาสูง; ไม่มี Ca/Al load" },
  { name:"Aluminum hydroxide", cls:"Phosphate binder (Al-based)", strengths:["200 mg","320 mg"], flags:["contra"],
    note:"⚠️ AVOID ใน CKD: Al สะสม → encephalopathy, osteomalacia, anemia; ใช้เฉพาะกรณีฉุกเฉินระยะสั้น" },

  /* ===== CKD-SPECIFIC: Vit D / MINERAL METABOLISM ===== */
  { name:"Calcitriol", cls:"Active Vit D (1,25-dihydroxy)", strengths:["0.25 mcg","0.5 mcg"], flags:[],
    note:"CKD 3-5: ใช้รักษา secondary hyperparathyroidism; ติดตาม Ca, P, PTH" },
  { name:"Alfacalcidol", cls:"Vit D analog (1-alpha)", strengths:["0.25 mcg","0.5 mcg","1 mcg"], flags:[],
    note:"Prodrug → calcitriol; ต้องผ่าน hepatic hydroxylation; ใช้ได้ใน CKD" },
  { name:"Paricalcitol", cls:"Vit D analog (selective VDR)", strengths:["1 mcg","2 mcg","4 mcg cap"], flags:[],
    note:"Selective VDRA; ลด hypercalcemia vs calcitriol; Preferred ใน SHPT บน dialysis" },
  { name:"Cholecalciferol (Vit D3)", cls:"Vit D supplement", strengths:["400 IU","1000 IU","2000 IU","5000 IU"], flags:[],
    note:"Replete 25-OH Vit D; ใช้ใน CKD 1-3; ก่อนใช้ active Vit D" },
  { name:"Cinacalcet", cls:"Calcimimetic", strengths:["30 mg","60 mg","90 mg"], flags:[],
    note:"CKD 5D on dialysis; ลด PTH และ Ca×P; ระวัง hypocalcemia; กินพร้อมอาหาร" },

  /* ===== CKD-SPECIFIC: ANEMIA ===== */
  { name:"Ferrous fumarate", cls:"Oral iron", strengths:["200 mg (66 mg Fe)","330 mg"], flags:[],
    note:"กินตอนท้องว่าง; GI side effects บ่อย; ไม่กินพร้อม phosphate binder" },
  { name:"Ferrous sulfate", cls:"Oral iron", strengths:["300 mg (60 mg Fe)"], flags:[],
    note:"ถูกที่สุด; GI side effects สูง; ไม่กินพร้อม antacid หรือ phosphate binder" },
  { name:"Iron polymaltose complex", cls:"Oral iron", strengths:["100 mg elemental"], flags:[],
    note:"GI side effects น้อยกว่า ferrous salt; กินพร้อมอาหารได้; absorb ช้ากว่า" },
  { name:"Iron sucrose IV", cls:"IV iron", strengths:["100 mg/5 mL"], flags:[],
    note:"CKD+HD: 100-200 mg/dose IV slowly; ติดตาม allergic reaction" },
  { name:"Ferric carboxymaltose IV", cls:"IV iron (high-dose)", strengths:["500 mg/10 mL","1000 mg/20 mL"], flags:[],
    note:"Single dose 500-1000 mg; preferred non-dialysis CKD; ลด IV iron frequency" },
  { name:"Epoetin alfa (rHuEPO)", cls:"ESA", strengths:["2000 IU","4000 IU","10000 IU"], flags:[],
    note:"Target Hb 10-11.5 g/dL; ห้ามให้ถ้า Hb>12; ระวัง HTN และ thrombosis" },
  { name:"Darbepoetin alfa", cls:"ESA (long-acting)", strengths:["25 mcg","40 mcg","60 mcg","100 mcg"], flags:[],
    note:"Q2W หรือ Q4W; สะดวกกว่า EPO; target Hb เดียวกัน; ราคาสูงกว่า" },
  { name:"Methoxy polyethylene glycol-epoetin beta", cls:"ESA (continuous)", strengths:["50 mcg","75 mcg","100 mcg","150 mcg"], flags:[],
    note:"Q1M; สะดวกที่สุด; ใช้ใน CKD ND และ HD" },
  { name:"Folic acid", cls:"Vitamin B9", strengths:["1 mg","5 mg"], flags:[],
    note:"CKD+dialysis: 1-5 mg/day; hyperhomocysteinemia; ลด loss จาก dialysis" },
  { name:"Vitamin B12 (Cyanocobalamin)", cls:"Vitamin B12", strengths:["0.5 mcg","1 mcg tab","1000 mcg/mL IM"], flags:[],
    note:"ให้เสริมใน CKD ที่มี deficiency; มักเสียทาง dialysis" },

  /* ===== ELECTROLYTE / ACID-BASE ===== */
  { name:"Sodium bicarbonate", cls:"Oral alkali", strengths:["300 mg","600 mg","650 mg"], flags:[],
    note:"Target serum HCO₃⁻ 22-24 mEq/L; ระวัง Na overload และ fluid retention" },
  { name:"Sodium polystyrene sulfonate (SPS)", cls:"K⁺ binder (resin, old)", strengths:["15 g sachet"], flags:[],
    note:"ลด K⁺; ระวัง intestinal necrosis ถ้าใช้ sorbitol; ผล onset ช้า 4-6h" },
  { name:"Patiromer sorbitex calcium", cls:"K⁺ binder (new)", strengths:["8.4 g","16.8 g"], flags:[],
    note:"✓ New generation K-binder; 1ครั้ง/วัน; น้อย GI effects; ห่าง 6h จากยาอื่น" },
  { name:"Sodium zirconium cyclosilicate (ZS-9)", cls:"K⁺ binder (new)", strengths:["5 g","10 g"], flags:[],
    note:"✓ Onset เร็วที่สุด (1-2h); ใช้ใน hyperkalemia เฉียบพลัน; Max 10 g/day" },
  { name:"Potassium chloride", cls:"K⁺ supplement", strengths:["300 mg (4 mEq)","600 mg (8 mEq)","750 mg SR"], flags:["k"],
    note:"⚠️ ใช้เฉพาะ hypokalemia ที่ยืนยันแล้ว; AVOID ถ้า K⁺>4.0 ใน CKD" },

  /* ===== ANTIBIOTICS (ที่ต้องปรับ dose ใน CKD) ===== */
  { name:"Amoxicillin", cls:"Aminopenicillin", strengths:["250 mg","500 mg"], flags:["renal"],
    note:"eGFR 10-30: 250 mg q8h; <10: 250 mg q12h" },
  { name:"Amoxicillin+Clavulanate", cls:"Beta-lactam+inhibitor", strengths:["375 mg","625 mg","1000 mg"], flags:["renal"],
    note:"eGFR 10-30: 250/125 mg q12h; ห้ามใช้ 875 mg ถ้า eGFR<30" },
  { name:"Cephalexin", cls:"Cephalosporin 1st gen", strengths:["250 mg","500 mg"], flags:["renal"],
    note:"eGFR<30: 500 mg q8-12h; eGFR<10: 250 mg q12h" },
  { name:"Cefuroxime", cls:"Cephalosporin 2nd gen", strengths:["250 mg","500 mg"], flags:["renal"],
    note:"eGFR 10-20: q12h; <10: q24h" },
  { name:"Ciprofloxacin", cls:"Fluoroquinolone", strengths:["250 mg","500 mg","750 mg"], flags:["renal"],
    note:"eGFR<30: 250-500 mg q12-24h; ระวัง QTc prolongation ใน CKD" },
  { name:"Levofloxacin", cls:"Fluoroquinolone", strengths:["250 mg","500 mg","750 mg"], flags:["renal"],
    note:"eGFR 20-49: 250 mg q24h; <20: 250 mg loading → 125 mg q24h" },
  { name:"Trimethoprim+Sulfamethoxazole", cls:"TMP-SMX", strengths:["80/400 mg","160/800 mg"], flags:["renal","k"],
    note:"⚠️ เพิ่ม K⁺ (TMP บล็อก tubular K secretion); เพิ่ม Scr จริง; ลด dose ถ้า eGFR<30" },
  { name:"Nitrofurantoin", cls:"Urinary antiseptic", strengths:["50 mg","100 mg"], flags:["contra"],
    note:"⚠️ AVOID eGFR<30 — ไม่ได้ผล (no urinary concentration) + toxic (peripheral neuropathy)" },
  { name:"Gentamicin", cls:"Aminoglycoside", strengths:["40 mg/mL","80 mg/2 mL"], flags:["nephrotoxic","renal"],
    note:"⚠️ NEPHROTOXIC; Once-daily dosing preferred; ติดตาม peak/trough level; hydrate ดี" },
  { name:"Vancomycin", cls:"Glycopeptide", strengths:["500 mg IV","1 g IV"], flags:["renal","nephrotoxic"],
    note:"⚠️ AUC-guided dosing; ติดตาม trough <15 mg/L; เสี่ยง nephrotoxicity ↑ใน CKD" },
  { name:"Meropenem", cls:"Carbapenem", strengths:["500 mg IV","1 g IV"], flags:["renal"],
    note:"eGFR 26-50: q12h; 10-25: q12h ครึ่ง dose; <10: q24h ครึ่ง dose" },
  { name:"Fluconazole", cls:"Antifungal (azole)", strengths:["50 mg","100 mg","150 mg","200 mg"], flags:["renal"],
    note:"eGFR<50: ลด dose 50%; ติดตาม hepatotoxicity; หลายๆ drug interactions" },

  /* ===== ANALGESICS ===== */
  { name:"Paracetamol (Acetaminophen)", cls:"Non-opioid analgesic", strengths:["325 mg","500 mg","650 mg ER"], flags:[],
    note:"✓ PREFERRED analgesic ใน CKD; max 2-3 g/day; หลีกเลี่ยง >2 g/day ถ้าดื่มสุรา" },
  { name:"Tramadol", cls:"Weak opioid agonist", strengths:["50 mg","100 mg SR","200 mg SR"], flags:["renal"],
    note:"⚠️ AVOID eGFR<30 (accumulation M1 metabolite); eGFR 30-60: extend interval; seizure risk" },
  { name:"Codeine", cls:"Opioid prodrug", strengths:["15 mg","30 mg","60 mg"], flags:["renal","contra"],
    note:"⚠️ AVOID ใน CKD: morphine-6-glucuronide สะสม → respiratory depression" },
  { name:"Gabapentin", cls:"Neuromodulator (analgesic)", strengths:["100 mg","300 mg","400 mg"], flags:["renal"],
    note:"⚠️ ปรับ dose เข้มงวด: eGFR 30-59→300 mg BD; 15-29→300 mg OD; <15→300 mg ทุก 2 วัน" },
  { name:"Pregabalin", cls:"Neuromodulator", strengths:["25 mg","50 mg","75 mg","150 mg","300 mg"], flags:["renal"],
    note:"ลด dose สัดส่วนกับ eGFR: ลด 50% ทุกที่ eGFR ลด 50%; sedation ↑ ใน uremia" },
  { name:"Ibuprofen", cls:"NSAID (OTC)", strengths:["200 mg","400 mg","600 mg"], flags:["nephrotoxic","contra"],
    note:"⛔ CONTRAINDICATED ใน CKD: ลด renal blood flow → AKI; hyperkalemia; fluid retention" },
  { name:"Naproxen", cls:"NSAID", strengths:["250 mg","500 mg"], flags:["nephrotoxic","contra"],
    note:"⛔ CONTRAINDICATED ใน CKD; ยาต้านอักเสบ NSAID ทุกตัวห้ามใน CKD stage ≥3" },
  { name:"Diclofenac", cls:"NSAID", strengths:["25 mg","50 mg","75 mg SR","100 mg SR"], flags:["nephrotoxic","contra"],
    note:"⛔ CONTRAINDICATED; CV risk สูงสุดในกลุ่ม NSAID; ห้ามในทุก stage CKD ที่มี dysfunction" },
  { name:"Celecoxib", cls:"COX-2 inhibitor", strengths:["100 mg","200 mg","400 mg"], flags:["nephrotoxic","contra"],
    note:"⛔ COX-2 selective ไม่ได้ลด nephrotoxicity; ห้ามใช้ใน CKD; CV risk สูง" },
  { name:"Aspirin (antiplatelet)", cls:"Antiplatelet", strengths:["81 mg","100 mg"], flags:[],
    note:"Low-dose antiplatelet: ใช้ได้ใน CKD; ห้ามใช้ในขนาด analgesic/anti-inflammatory (>325 mg)" },

  /* ===== ANTICOAGULANTS ===== */
  { name:"Warfarin", cls:"Vitamin K antagonist", strengths:["1 mg","2 mg","3 mg","5 mg"], flags:["renal"],
    note:"ติดตาม INR ถี่ขึ้นใน CKD; bleeding risk ↑; ระวัง calciphylaxis ในผู้ป่วย dialysis" },
  { name:"Apixaban", cls:"DOAC (Factor Xa inhibitor)", strengths:["2.5 mg","5 mg"], flags:["renal"],
    note:"✓ Preferred DOAC ใน CKD (ไม่ต้องปรับถ้า eGFR≥25); ลด dose: ≥2 criteria [age≥80, wt≤60, Cr≥1.5]" },
  { name:"Rivaroxaban", cls:"DOAC (Factor Xa inhibitor)", strengths:["10 mg","15 mg","20 mg"], flags:["renal","contra"],
    note:"AVOID eGFR<15; AF: 15 mg OD ถ้า eGFR 15-49; ใช้กับอาหาร" },
  { name:"Dabigatran", cls:"DOAC (Direct thrombin inhibitor)", strengths:["75 mg","110 mg","150 mg"], flags:["renal","contra"],
    note:"⚠️ AVOID eGFR<30; 80% renal excretion — สะสมมาก ใน CKD; เสี่ยง bleed สูง" },
  { name:"Enoxaparin (LMWH)", cls:"Low molecular weight heparin", strengths:["20 mg","40 mg","60 mg","80 mg","100 mg"], flags:["renal"],
    note:"eGFR<30: 1 mg/kg q24h (ลด 50%); ติดตาม anti-Xa; พิจารณา UFH แทนใน severe CKD" },

  /* ===== GI / OTHERS ===== */
  { name:"Omeprazole", cls:"PPI", strengths:["10 mg","20 mg","40 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ระวัง Mg²⁺ ต่ำ long-term; drug interactions (clopidogrel)" },
  { name:"Pantoprazole", cls:"PPI", strengths:["20 mg","40 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; น้อย drug interactions; preferred IV PPI" },
  { name:"Esomeprazole", cls:"PPI", strengths:["20 mg","40 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; isomer ของ omeprazole" },
  { name:"Ranitidine", cls:"H2 blocker", strengths:["75 mg","150 mg","300 mg"], flags:["renal"],
    note:"ลด dose: eGFR<50: 150 mg q24h; <10: 150 mg q48h; เพิ่ม Scr ปลอม" },
  { name:"Metoclopramide", cls:"Prokinetic antiemetic", strengths:["5 mg","10 mg"], flags:["renal"],
    note:"ลด dose 50% ถ้า eGFR<40; EPS risk ↑ ใน uremia; ใช้ระยะสั้น <5 วัน" },
  { name:"Ondansetron", cls:"5-HT3 antiemetic", strengths:["4 mg","8 mg"], flags:[],
    note:"✓ Preferred antiemetic ใน CKD/dialysis; ไม่ต้องปรับ dose; ติดตาม QTc" },
  { name:"Domperidone", cls:"Prokinetic D2 antagonist", strengths:["10 mg"], flags:["renal"],
    note:"ลด dose ใน severe CKD; ระวัง QTc prolongation; ไม่เกิน 10 mg TID" },

  /* ===== CARDIAC ===== */
  { name:"Digoxin", cls:"Cardiac glycoside", strengths:["0.0625 mg","0.125 mg","0.25 mg"], flags:["renal"],
    note:"⚠️ สะสมมากใน CKD; ลด dose สัดส่วน; ติดตาม level (0.5-0.9 ng/mL ใน HF); Narrow TI" },
  { name:"Amiodarone", cls:"Antiarrhythmic class III", strengths:["100 mg","200 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ติดตาม TFT, LFT, CXR ทุกปี; T½ นานมาก (40-55 วัน)" },
  { name:"Ivabradine", cls:"HCN-channel blocker (HR reduction)", strengths:["5 mg","7.5 mg"], flags:[],
    note:"ไม่ต้องปรับ dose ใน CKD; ใช้ใน HFrEF ที่ยังมี HR>70 บน beta-blocker max dose" },

  /* ===== PSYCHIATRIC (common in CKD) ===== */
  { name:"Sertraline", cls:"SSRI antidepressant", strengths:["25 mg","50 mg","100 mg"], flags:[],
    note:"✓ Preferred antidepressant ใน CKD; ไม่ต้องปรับ dose; ติดตาม Na⁺ ลด" },
  { name:"Escitalopram", cls:"SSRI antidepressant", strengths:["5 mg","10 mg","20 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ดีสำหรับ depression+anxiety ใน CKD; QTc monitoring" },
  { name:"Mirtazapine", cls:"NaSSA antidepressant", strengths:["15 mg","30 mg","45 mg"], flags:[],
    note:"ไม่ต้องปรับ dose; ช่วย appetite และ sleep; ใช้ได้ใน CKD uremic pruritus" },
  { name:"Alprazolam", cls:"Benzodiazepine", strengths:["0.25 mg","0.5 mg","1 mg"], flags:["renal"],
    note:"ลด dose ใน CKD; CNS depression ↑ ใน uremia; avoid long-term; fall risk" },
  { name:"Zolpidem", cls:"Non-BZD sedative-hypnotic", strengths:["5 mg","10 mg"], flags:["renal"],
    note:"เริ่ม 5 mg ใน CKD; short-term only; fall risk ↑ ใน elderly+CKD" },
];

const FLAG_LABEL = {
  nephrotoxic: { th: "Nephrotoxic", color: "#c2410c" },
  contra:      { th: "ห้ามใช้/ระวังมากใน CKD", color: "#b91c1c" },
  renal:       { th: "ปรับขนาดตามไต", color: "#a16207" },
  k:           { th: "เสี่ยง K⁺", color: "#7c3aed" },
};

function lookupDrug(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return DRUG_DB.find((d) => d.name.toLowerCase() === n) ||
         DRUG_DB.find((d) => d.name.toLowerCase().startsWith(n)) || null;
}

/* =========================================================================
   DRUG_DOSING — ขนาดยาสูงสุดต่อวัน (ปรับตาม eGFR) สำหรับตรวจ "ขนาดรวมเกิน"
   อ้างอิง: KDIGO 2024, Lexicomp Renal Dosing, Thai NLEM, UpToDate
   โครงสร้าง:
     unit       — หน่วยของ strength (mg / mcg / IU / g)
     maxDaily   — ขนาดสูงสุดต่อวันปกติ (ไม่คิด CKD)
     renalMax   — ขนาดสูงสุดที่ปรับตาม eGFR; เรียงจาก eGFR สูง→ต่ำ
                  ระบบจะเลือก tier แรกที่ egfr >= tier.egfr
                  max=0 หมายถึง "ห้ามใช้ที่ eGFR นี้"
   หมายเหตุ: ใช้ชื่อ key ตรงกับ d.name ใน DRUG_DB
   ========================================================================= */
const DRUG_DOSING = {
  "Metformin":        { unit:"mg", maxDaily:2550, renalMax:[{egfr:45,max:2000},{egfr:30,max:1000},{egfr:0,max:0}] },
  "Allopurinol":      { unit:"mg", maxDaily:800,  renalMax:[{egfr:60,max:300},{egfr:30,max:200},{egfr:0,max:100}] },
  "Gabapentin":       { unit:"mg", maxDaily:3600, renalMax:[{egfr:60,max:3600},{egfr:30,max:1400},{egfr:15,max:700},{egfr:0,max:300}] },
  "Pregabalin":       { unit:"mg", maxDaily:600,  renalMax:[{egfr:60,max:600},{egfr:30,max:300},{egfr:15,max:150},{egfr:0,max:75}] },
  "Atenolol":         { unit:"mg", maxDaily:100,  renalMax:[{egfr:35,max:100},{egfr:15,max:50},{egfr:0,max:25}] },
  "Bisoprolol":       { unit:"mg", maxDaily:10,   renalMax:[{egfr:20,max:10},{egfr:0,max:5}] },
  "Rosuvastatin":     { unit:"mg", maxDaily:40,   renalMax:[{egfr:30,max:40},{egfr:0,max:10}] },
  "Pravastatin":      { unit:"mg", maxDaily:80,   renalMax:[{egfr:30,max:80},{egfr:0,max:20}] },
  "Pitavastatin":     { unit:"mg", maxDaily:4,    renalMax:[{egfr:30,max:4},{egfr:0,max:2}] },
  "Simvastatin":      { unit:"mg", maxDaily:40 },
  "Atorvastatin":     { unit:"mg", maxDaily:80 },
  "Colchicine":       { unit:"mg", maxDaily:1.2,  renalMax:[{egfr:60,max:1.2},{egfr:30,max:0.6},{egfr:0,max:0}] },
  "Tramadol":         { unit:"mg", maxDaily:400,  renalMax:[{egfr:30,max:200},{egfr:0,max:0}] },
  "Sitagliptin":      { unit:"mg", maxDaily:100,  renalMax:[{egfr:45,max:100},{egfr:30,max:50},{egfr:0,max:25}] },
  "Vildagliptin":     { unit:"mg", maxDaily:100,  renalMax:[{egfr:50,max:100},{egfr:0,max:50}] },
  "Saxagliptin":      { unit:"mg", maxDaily:5,    renalMax:[{egfr:45,max:5},{egfr:0,max:2.5}] },
  "Glipizide":        { unit:"mg", maxDaily:20 },
  "Gliclazide":       { unit:"mg", maxDaily:120 },
  "Glibenclamide":    { unit:"mg", maxDaily:20,   renalMax:[{egfr:60,max:10},{egfr:0,max:0}] },
  "Paracetamol (Acetaminophen)": { unit:"mg", maxDaily:4000, renalMax:[{egfr:999,max:3000}] },
  "Amlodipine":       { unit:"mg", maxDaily:10 },
  "Enalapril":        { unit:"mg", maxDaily:40,   renalMax:[{egfr:30,max:40},{egfr:0,max:20}] },
  "Ramipril":         { unit:"mg", maxDaily:10,   renalMax:[{egfr:30,max:10},{egfr:0,max:5}] },
  "Lisinopril":       { unit:"mg", maxDaily:40,   renalMax:[{egfr:30,max:40},{egfr:0,max:10}] },
  "Losartan":         { unit:"mg", maxDaily:100 },
  "Spironolactone":   { unit:"mg", maxDaily:100,  renalMax:[{egfr:30,max:50},{egfr:0,max:0}] },
  "Hydrochlorothiazide": { unit:"mg", maxDaily:50, renalMax:[{egfr:30,max:50},{egfr:0,max:0}] },
  "Furosemide":       { unit:"mg", maxDaily:600 },
  "Digoxin":          { unit:"mg", maxDaily:0.25, renalMax:[{egfr:50,max:0.25},{egfr:30,max:0.125},{egfr:0,max:0.0625}] },
  "Amoxicillin":      { unit:"mg", maxDaily:3000, renalMax:[{egfr:30,max:1500},{egfr:10,max:750},{egfr:0,max:500}] },
  "Ciprofloxacin":    { unit:"mg", maxDaily:1500, renalMax:[{egfr:30,max:1000},{egfr:0,max:500}] },
  "Levofloxacin":     { unit:"mg", maxDaily:750,  renalMax:[{egfr:50,max:750},{egfr:20,max:250},{egfr:0,max:250}] },
};

// maxDailyDoseFor(name, egfr) → { max:number, renal:bool } | null
function maxDailyDoseFor(name, egfr) {
  const info = lookupDrug(name);
  const key = info ? info.name : name;
  const d = DRUG_DOSING[key];
  if (!d) return null;
  const eg = parseFloat(egfr);
  if (!isNaN(eg) && Array.isArray(d.renalMax)) {
    for (const tier of d.renalMax) {
      if (eg >= tier.egfr) return { max: tier.max, renal: true, unit: d.unit };
    }
  }
  if (d.maxDaily != null) return { max: d.maxDaily, renal: false, unit: d.unit };
  return null;
}

Object.assign(window, { DRUG_DB, FLAG_LABEL, lookupDrug, DRUG_DOSING, maxDailyDoseFor });
