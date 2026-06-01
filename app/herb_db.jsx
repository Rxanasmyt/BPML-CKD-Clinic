/* =========================================================================
   herb_db.jsx — ฐานข้อมูลสมุนไพรไทย, อาหารเสริม, ยา OTC ที่เกี่ยวข้องกับ CKD
   อ้างอิง: Thai Herbal Pharmacopoeia, WHO monographs, UpToDate Drug-Herb Interactions
   ========================================================================= */

const HERB_DB = [
  /* ===== สมุนไพรไทย (Thai Herbs) ===== */
  { name:"ขมิ้นชัน (Turmeric/Curcumin)", type:"herb", th:"ขมิ้นชัน", en:"Turmeric",
    flags:["bleeding","renal"], ckdNote:"ขนาดสูงอาจมี oxalate → นิ่วไต; ระวังกับยาต้านการแข็งตัวของเลือด" },
  { name:"กระชาย (Kaempferia/Chinese ginger)", type:"herb", th:"กระชาย",
    flags:["bleeding","nephrotoxic"], ckdNote:"มีรายงาน nephrotoxicity; อาจเพิ่ม INR ร่วมกับ warfarin" },
  { name:"ฟ้าทะลายโจร (Andrographis)", type:"herb", th:"ฟ้าทะลายโจร",
    flags:["bleeding","bp"], ckdNote:"ลด platelet aggregation; ระวังกับยาต้านการแข็งตัวเลือดและยาลด BP" },
  { name:"ชะเอมเทศ (Licorice root)", type:"herb", th:"ชะเอมเทศ", en:"Licorice",
    flags:["k","bp","na"], ckdNote:"⚠️ Pseudoaldosteronism: ↑ BP, ↓ K⁺, ↑ Na⁺ — อันตรายใน CKD; ห้ามใช้ร่วม loop diuretic+digoxin" },
  { name:"กระเจี๊ยบแดง (Roselle/Hibiscus)", type:"herb", th:"กระเจี๊ยบแดง", en:"Hibiscus",
    flags:["bp"], ckdNote:"ลด BP ได้จริง; ระวัง BP ต่ำมากถ้าใช้ร่วมยาความดัน; oxalate → นิ่วไตได้" },
  { name:"มะระขี้นก (Bitter melon)", type:"herb", th:"มะระขี้นก", en:"Bitter melon",
    flags:["glucose"], ckdNote:"ลดน้ำตาลได้ → hypoglycemia ถ้าร่วมกับ insulin หรือ sulfonylurea" },
  { name:"ใบหม่อน (Mulberry leaf)", type:"herb", th:"ใบหม่อน", en:"Mulberry",
    flags:["glucose"], ckdNote:"ลดน้ำตาล → ระวัง hypoglycemia ถ้าใช้ร่วมกับยาเบาหวาน" },
  { name:"โสม (Ginseng)", type:"herb", th:"โสม", en:"Ginseng",
    flags:["bleeding","bp","glucose"], ckdNote:"อาจเพิ่ม BP; ลด INR ร่วม warfarin; ลดน้ำตาล → ระวัง hypoglycemia" },
  { name:"ว่านหางจระเข้ (Aloe vera)", type:"herb", th:"ว่านหางจระเข้", en:"Aloe vera",
    flags:["k","renal"], ckdNote:"กินสด: ลด K⁺, ท้องเสีย → dehydration → AKI; ห้ามใช้ระยะยาว" },
  { name:"ขิง (Ginger)", type:"herb", th:"ขิง", en:"Ginger",
    flags:["bleeding"], ckdNote:"ขนาดสูง: ลด platelet aggregation → ระวังร่วม anticoagulant" },
  { name:"กระเทียม (Garlic)", type:"herb", th:"กระเทียม", en:"Garlic",
    flags:["bleeding","bp"], ckdNote:"ลด BP; ขนาดสูง: ลด platelet → ระวัง anticoagulant" },
  { name:"ใบบัวบก (Centella/Gotu kola)", type:"herb", th:"ใบบัวบก", en:"Centella asiatica",
    flags:[], ckdNote:"ปลอดภัยในขนาดอาหาร; ขนาดสูง: ระวัง hepatotoxicity" },
  { name:"ชุมเห็ดเทศ (Cassia alata)", type:"herb", th:"ชุมเห็ดเทศ",
    flags:["k"], ckdNote:"ฤทธิ์ระบาย → ท้องเสีย → ↓ K⁺ → ระวังร่วม digoxin หรือ loop diuretic" },
  { name:"ดีปลี (Long pepper)", type:"herb", th:"ดีปลี",
    flags:[], ckdNote:"อาจเพิ่ม bioavailability ยาอื่น (piperine effect) → เพิ่ม drug level" },
  { name:"บอระเพ็ด (Tinospora)", type:"herb", th:"บอระเพ็ด",
    flags:["glucose","renal"], ckdNote:"ลดน้ำตาล; รายงาน nephrotoxicity ในขนาดสูง" },
  { name:"มะขามแขก (Senna)", type:"herb", th:"มะขามแขก", en:"Senna",
    flags:["k"], ckdNote:"ยาระบาย: ท้องเสีย → ↓ K⁺; ห้ามใช้ระยะยาวใน CKD" },
  { name:"หญ้าหนวดแมว (Java tea/Orthosiphon)", type:"herb", th:"หญ้าหนวดแมว", en:"Cat's whiskers",
    flags:["renal","k"], ckdNote:"ขับปัสสาวะ; รายงาน nephrotoxicity; ควรหลีกเลี่ยงใน CKD" },
  { name:"สะระแหน่ (Peppermint)", type:"herb", th:"สะระแหน่", en:"Peppermint",
    flags:[], ckdNote:"ปลอดภัยทั่วไป; กรดไหลย้อน ถ้าใช้มาก" },
  { name:"ตะไคร้ (Lemongrass)", type:"herb", th:"ตะไคร้", en:"Lemongrass",
    flags:[], ckdNote:"ปลอดภัยในปริมาณอาหาร" },
  { name:"น้ำมะพร้าว (Coconut water)", type:"herb", th:"น้ำมะพร้าว",
    flags:["k"], ckdNote:"⚠️ K⁺ สูง ~600 mg/cup — AVOID ใน CKD stage 3-5 ที่มี hyperkalemia" },
  { name:"กล้วยน้ำว้า (Banana extract/supplement)", type:"supplement", th:"กล้วยน้ำว้า",
    flags:["k"], ckdNote:"K⁺ สูง — ควรจำกัดปริมาณใน CKD" },
  { name:"มะพร้าวน้ำหอม", type:"herb", th:"มะพร้าวน้ำหอม", flags:["k"],
    ckdNote:"K⁺ สูงพอสมควร — ระวังใน hyperkalemia" },

  /* ===== อาหารเสริม (Supplements) ===== */
  { name:"วิตามิน D3 (Vitamin D3/Cholecalciferol)", type:"supplement", th:"วิตามิน ดี 3",
    flags:[], ckdNote:"ปลอดภัยในขนาด supplementation; ขนาดสูง → hypercalcemia" },
  { name:"แคลเซียม (Calcium supplement)", type:"supplement", th:"แคลเซียม",
    flags:[], ckdNote:"ระวัง hypercalcemia ใน CKD; ห้ามกินพร้อม fluoroquinolone, levothyroxine" },
  { name:"แมกนีเซียม (Magnesium supplement)", type:"supplement", th:"แมกนีเซียม",
    flags:["renal"], ckdNote:"⚠️ สะสมใน CKD → hypermagnesemia → cardiac arrest; AVOID eGFR<30" },
  { name:"โพแทสเซียม (Potassium supplement)", type:"supplement", th:"โพแทสเซียม",
    flags:["k"], ckdNote:"⚠️ อันตรายมากใน CKD — ห้ามใช้ถ้า K⁺>4.0 หรือ eGFR<30" },
  { name:"น้ำมันปลา/โอเมก้า-3 (Fish oil/Omega-3)", type:"supplement", th:"น้ำมันปลา",
    flags:["bleeding"], ckdNote:"ขนาดสูง (>3g/day): ลด platelet → ระวังร่วม warfarin/anticoagulant" },
  { name:"CoQ10 (Coenzyme Q10)", type:"supplement", th:"โคคิวเท็น",
    flags:["bp","glucose"], ckdNote:"อาจลด BP; อาจลดน้ำตาล → ระวังร่วมยาความดันและยาเบาหวาน" },
  { name:"วิตามิน E (Vitamin E)", type:"supplement", th:"วิตามิน อี",
    flags:["bleeding"], ckdNote:"ขนาดสูง (>400 IU/day): ↑ bleeding risk ร่วม warfarin" },
  { name:"วิตามิน C (Vitamin C)", type:"supplement", th:"วิตามิน ซี",
    flags:["renal"], ckdNote:"ขนาดสูง → oxalate → นิ่วไต; max 60-90 mg/day ใน CKD" },
  { name:"กลูโคซามีน (Glucosamine)", type:"supplement", th:"กลูโคซามีน",
    flags:["glucose","renal"], ckdNote:"เพิ่ม insulin resistance; อาจเพิ่ม INR ร่วม warfarin; ระวัง CKD" },
  { name:"คอลลาเจน (Collagen)", type:"supplement", th:"คอลลาเจน",
    flags:[], ckdNote:"โปรตีนสูง → ระวัง protein load ใน CKD stage 4-5 (ปรึกษาแพทย์)" },
  { name:"ถั่งเช่า (Cordyceps)", type:"supplement", th:"ถั่งเช่า", en:"Cordyceps",
    flags:["k","renal"], ckdNote:"อาจลด Scr/เพิ่ม eGFR (บางการศึกษา); ระวัง interaction" },
  { name:"เห็ดหลินจือ (Reishi/Ganoderma)", type:"supplement", th:"เห็ดหลินจือ",
    flags:["bleeding","bp"], ckdNote:"ลด BP; ลด platelet → ระวังร่วม anticoagulant" },
  { name:"ชาเขียว extract (Green tea extract)", type:"supplement", th:"ชาเขียว",
    flags:["bleeding","renal"], ckdNote:"oxalate → นิ่ว; caffeine เพิ่ม BP; EGCG: ระวังร่วม warfarin" },
  { name:"ไฟเบอร์ Psyllium (Psyllium husk)", type:"supplement", th:"ไฟเบอร์ Psyllium",
    flags:[], ckdNote:"ลด phosphate absorption; กินห่างยาอื่น 2 ชั่วโมง" },
  { name:"โปรไบโอติก (Probiotic)", type:"supplement", th:"โปรไบโอติก",
    flags:[], ckdNote:"ปลอดภัยทั่วไป; บางสายพันธุ์ช่วยลด uremic toxin" },
  { name:"วิตามิน B1 (Thiamine)", type:"supplement", th:"วิตามิน บี 1",
    flags:[], ckdNote:"ปลอดภัย; ผู้ป่วยล้างไต: ขาดได้ง่าย ควรเสริม" },
  { name:"วิตามิน B6 (Pyridoxine)", type:"supplement", th:"วิตามิน บี 6",
    flags:[], ckdNote:"ปลอดภัย; ขนาดสูง >200 mg/day → peripheral neuropathy" },
  { name:"กรดโฟลิก (Folic acid)", type:"supplement", th:"กรดโฟลิก",
    flags:[], ckdNote:"ปลอดภัย; แนะนำเสริม 1-5 mg/day ใน CKD" },
  { name:"ธาตุเหล็ก OTC (Iron supplement)", type:"supplement", th:"ธาตุเหล็ก",
    flags:[], ckdNote:"อย่ากินพร้อม phosphate binder; ห่างยาอื่น 2 ชั่วโมง" },
  { name:"สังกะสี (Zinc)", type:"supplement", th:"สังกะสี", en:"Zinc",
    flags:["renal"], ckdNote:"ลด copper absorption; ขนาดสูง → ↓ immune; ระวังสะสมใน CKD" },
  { name:"ซีลีเนียม (Selenium)", type:"supplement", th:"ซีลีเนียม",
    flags:["renal"], ckdNote:"ขนาดสูง toxic; ไม่ต้องเสริมถ้าได้จากอาหาร" },

  /* ===== ยา OTC ที่ผู้ป่วยซื้อเอง ===== */
  { name:"ยาแก้ปวด Ibuprofen OTC (Advil, Nurofen)", type:"otc",
    flags:["nephrotoxic","contra"], ckdNote:"⛔ AVOID ใน CKD ทุก stage — AKI, hyperkalemia, ↑ BP, fluid retention" },
  { name:"ยาแก้ปวด Naproxen OTC", type:"otc",
    flags:["nephrotoxic","contra"], ckdNote:"⛔ AVOID ใน CKD — เหมือน Ibuprofen" },
  { name:"ยาแก้ปวด Aspirin ขนาดสูง (>325 mg)", type:"otc",
    flags:["nephrotoxic","contra"], ckdNote:"NSAID effect ที่ขนาดสูง — ห้ามใน CKD; low-dose 81-100 mg antiplatelet ใช้ได้" },
  { name:"ยาลดกรด Aluminum hydroxide (แอนตาซิด Al)", type:"otc",
    flags:["contra","nephrotoxic"], ckdNote:"⚠️ Al สะสมใน CKD → encephalopathy; ใช้แค่ระยะสั้นและปรึกษาแพทย์" },
  { name:"ยาลดกรด Magnesium hydroxide (Milk of magnesia)", type:"otc",
    flags:["contra"], ckdNote:"⚠️ Mg สะสมใน CKD → hypermagnesemia → cardiac arrest; AVOID" },
  { name:"ยาลดกรด Calcium carbonate (Tums)", type:"otc",
    flags:[], ckdNote:"ใช้เป็น phosphate binder ได้; กินพร้อมอาหาร; ระวัง hypercalcemia" },
  { name:"ยาระบาย bisacodyl", type:"otc",
    flags:["k"], ckdNote:"ท้องเสีย → ↓ K⁺ และ dehydration; ระวังใน CKD" },
  { name:"ยาแก้ไอ/ลดน้ำมูก Pseudoephedrine", type:"otc",
    flags:["bp","renal"], ckdNote:"เพิ่ม BP; ระวังใน CKD + HTN; ปรับ dose ใน renal impairment" },
  { name:"ยาแก้ท้องเสีย Loperamide", type:"otc",
    flags:[], ckdNote:"ปลอดภัยทั่วไป; ระวัง constipation ในผู้ป่วย CKD ที่มีปัญหาอยู่แล้ว" },
  { name:"ครีมทา/ยาหม่อง (Methyl salicylate/NSAID topical)", type:"otc",
    flags:["renal"], ckdNote:"Systemic absorption ได้โดยเฉพาะผิวที่อักเสบ/ขนาดมาก; ระวัง CKD" },
  { name:"ยาคุมกำเนิด (Oral contraceptive pill)", type:"otc",
    flags:["bp","k"], ckdNote:"เพิ่ม BP; เพิ่ม K⁺ (drospirenone); ระวังใน CKD+HTN" },
];

const HERB_TYPE_LABEL = {
  herb:       { th: "🌿 สมุนไพร",    color: "#15803d", bg: "#f0fdf4" },
  supplement: { th: "💊 อาหารเสริม", color: "#0369a1", bg: "#eff6ff" },
  otc:        { th: "🏪 ยา OTC",     color: "#b45309", bg: "#fffbeb" },
};

function lookupHerb(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return HERB_DB.find((h) => h.name.toLowerCase() === n) ||
         HERB_DB.find((h) => h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase().split(" ")[0])) || null;
}

/* =========================================================================
   HERB_DOSING — ขนาดสูงสุดต่อวันของอาหารเสริมที่สำคัญใน CKD
   match แบบ keyword (ชื่อสมุนไพร/อาหารเสริมมักยาว) → ตรวจขนาดรวมเกิน
   อ้างอิง: KDOQI, NKF, WHO monographs, UpToDate (CKD supplement safety)
   ========================================================================= */
const HERB_DOSING = [
  { keys:["vitamin c","วิตามิน ซี","วิตามินซี","ascorbic"], unit:"mg", maxDaily:500,
    note:"Vitamin C >500 mg/วัน ใน CKD → oxalate สะสม → oxalate nephropathy" },
  { keys:["magnesium","แมกนีเซียม"], unit:"mg", maxDaily:0,
    note:"⚠️ AVOID Magnesium supplement ใน CKD (eGFR<30) — hypermagnesemia" },
  { keys:["fish oil","น้ำมันปลา","omega","โอเมก้า"], unit:"mg", maxDaily:2000,
    note:"Fish oil/Omega-3 >2 g/วัน + ยาต้านการแข็งตัวเลือด → เสี่ยงเลือดออก" },
  { keys:["potassium","โพแทสเซียม"], unit:"mg", maxDaily:0,
    note:"⚠️ AVOID K⁺ supplement ใน CKD ที่มีแนวโน้ม hyperkalemia" },
  { keys:["vitamin d","วิตามิน ดี","cholecalciferol","vit d"], unit:"IU", maxDaily:4000,
    note:"Vitamin D >4000 IU/วัน → hypercalcemia; ติดตาม Ca, 25-OH Vit D" },
  { keys:["calcium","แคลเซียม"], unit:"mg", maxDaily:2000,
    note:"Calcium รวม (อาหาร+เสริม) >2000 mg/วัน → vascular calcification ใน CKD" },
  { keys:["zinc","สังกะสี"], unit:"mg", maxDaily:40,
    note:"Zinc >40 mg/วัน → copper deficiency; ระวังใน CKD" },
  { keys:["vitamin a","วิตามิน เอ","retinol"], unit:"IU", maxDaily:3000,
    note:"⚠️ Vitamin A สะสมใน CKD → toxicity; หลีกเลี่ยงการเสริม" },
  { keys:["vitamin e","วิตามิน อี","tocopherol"], unit:"IU", maxDaily:400,
    note:"Vitamin E >400 IU/วัน → เพิ่มความเสี่ยงเลือดออก โดยเฉพาะร่วมยาต้านการแข็งตัวเลือด" },
  { keys:["vitamin b6","วิตามิน บี 6","วิตามินบี6","pyridoxine"], unit:"mg", maxDaily:100,
    note:"Vitamin B6 >100 mg/วัน นาน ๆ → peripheral neuropathy" },
  { keys:["coq10","coenzyme q10","โคคิวเท็น","ubiquinone"], unit:"mg", maxDaily:300,
    note:"CoQ10 >300 mg/วัน — อาจลด BP/น้ำตาล; ระวังร่วมยาความดัน/เบาหวาน/warfarin" },
  { keys:["glucosamine","กลูโคซามีน"], unit:"mg", maxDaily:1500,
    note:"Glucosamine >1500 mg/วัน — อาจเพิ่ม insulin resistance และ INR ร่วม warfarin; ระวังใน CKD" },
  { keys:["selenium","ซีลีเนียม"], unit:"mcg", maxDaily:400,
    note:"Selenium >400 mcg/วัน → selenosis (toxic); ไม่ควรเสริมถ้าได้จากอาหารพอ" },
  { keys:["green tea","ชาเขียว","egcg","แคทีชิน"], unit:"mg", maxDaily:800,
    note:"Green tea extract (EGCG) >800 mg/วัน → hepatotoxicity; oxalate→นิ่ว; ระวังร่วม warfarin" },
];

// maxDailyHerbFor(name) → { max, unit, note } | null
function maxDailyHerbFor(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  return HERB_DOSING.find((d) => d.keys.some((k) => n.includes(k))) || null;
}

Object.assign(window, { HERB_DB, HERB_TYPE_LABEL, lookupHerb, HERB_DOSING, maxDailyHerbFor });
