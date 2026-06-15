/* =========================================================================
   ai.jsx — แกนกลาง AI (Claude) สำหรับทั้งระบบ
   • callClaudeStream — เรียก Anthropic Messages API แบบ streaming จากเบราว์เซอร์
     (ต้องมี header anthropic-dangerous-direct-browser-access เพื่อข้าม CORS)
   • buildPatientContext / buildClinicContext — รวบรวมข้อมูลคลินิกที่แอพคำนวณไว้
     (computeRisk, predictEgfr, kdigoReferralCheck, DRP, DDI, renal dosing) ป้อนให้ AI
   • AI_PATIENT_MODES — โหมดผู้ช่วยเภสัชกร (สรุปแพทย์/แผนบริบาล/ความปลอดภัยยา/คำแนะนำผู้ป่วย)
   • computePharmKpis — ตัวชี้วัดการบริบาลทางเภสัชกรรม
   ========================================================================= */

const AI_MODEL  = "claude-opus-4-8";          // โมเดลที่เก่งที่สุดสำหรับเหตุผลทางคลินิก
const AI_KEY_LS = "pharm_ckd_claude_key";     // localStorage key (ต่อเครื่อง)

function getClaudeKey() { try { return localStorage.getItem(AI_KEY_LS) || ""; } catch (e) { return ""; } }
function setClaudeKey(k) {
  try { if (k && k.trim()) localStorage.setItem(AI_KEY_LS, k.trim()); else localStorage.removeItem(AI_KEY_LS); } catch (e) {}
}

/* ── streaming client — คืน text เต็ม + เรียก onDelta ทีละ chunk ── */
async function callClaudeStream({ apiKey, system, prompt, model, maxTokens, onDelta, signal }) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true", // จำเป็นสำหรับเรียกจากเบราว์เซอร์
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: model || AI_MODEL,
      max_tokens: maxTokens || 2048,
      system: system || undefined,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (resp.status === 401) throw new Error("API key ไม่ถูกต้อง (401 Unauthorized)");
  if (resp.status === 403) throw new Error("API key ไม่มีสิทธิ์ใช้งานโมเดลนี้ (403)");
  if (resp.status === 429) throw new Error("ใช้งานบ่อยเกินไป (Rate limit) — รอสักครู่แล้วลองใหม่");
  if (!resp.ok || !resp.body) {
    let detail = "";
    try { const j = await resp.json(); detail = j?.error?.message || ""; } catch (e) {}
    throw new Error(`เกิดข้อผิดพลาด HTTP ${resp.status}${detail ? " — " + detail : ""}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();                       // เก็บเศษบรรทัดสุดท้ายไว้รอบหน้า
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        full += ev.delta.text;
        if (onDelta) onDelta(ev.delta.text, full);
      } else if (ev.type === "error") {
        throw new Error(ev.error?.message || "เกิดข้อผิดพลาดระหว่าง stream");
      }
    }
  }
  if (!full.trim()) throw new Error("ไม่มีข้อความตอบกลับจาก AI");
  return full;
}

/* ── helpers สำหรับ build context ── */
function _aiLabLine(rec) {
  const parts = [];
  const add = (k, v, u) => { if (v !== undefined && v !== null && String(v).trim() !== "" && !isNaN(parseFloat(v))) parts.push(`${k} ${v}${u || ""}`); };
  add("eGFR", rec.egfr, " mL/min/1.73m²"); add("Scr", rec.scr, " mg/dL"); add("K⁺", rec.k, " mmol/L");
  add("Na", rec.na, " mmol/L"); add("Hb", rec.hb, " g/dL"); add("HCO₃⁻", rec.hco3, " mmol/L");
  add("PO₄", rec.phos, " mg/dL"); add("Ca", rec.ca, " mg/dL"); add("UACR", rec.uacr, " mg/g");
  if ((rec.bpSys && !isNaN(parseFloat(rec.bpSys))) || (rec.bpDia && !isNaN(parseFloat(rec.bpDia))))
    parts.push(`BP ${rec.bpSys || "?"}/${rec.bpDia || "?"} mmHg`);
  return parts.length ? parts.join(", ") : "ไม่มีข้อมูล lab";
}

/* รวมข้อมูลผู้ป่วย + ข่าวกรองคลินิกที่แอพคำนวณไว้ → context string สำหรับ AI */
function buildPatientContext(rec, patient, records) {
  const L = [];
  const fnRisk  = window.computeRisk, fnPred = window.predictEgfr, fnKdigo = window.kdigoReferralCheck;
  const fnProg  = window.medProgression, fnDDI = window.checkDDI;
  const fnCI    = window.checkContraindicated, fnDA = window.checkDoseAdjustment;
  const DRP_OPT = window.DRP_OPTIONS || [], INT_OPT = window.INTERVENTION_OPTIONS || [], SRC_OPT = window.SOURCE_OPTIONS || [];

  L.push(`ผู้ป่วย: ${patient?.name || rec.name || "-"} | HN ${rec.hn || "-"} | อายุ ${rec.age || "-"} ปี${rec.sex ? " | เพศ " + rec.sex : ""}${rec.dm ? " | เป็นเบาหวาน" : ""}`);
  L.push(`วันที่บันทึก: ${rec.date || "-"} | CKD ระยะ ${rec.ckdStage || "-"}`);
  L.push(`ผลแล็บ: ${_aiLabLine(rec)}`);
  if (rec.allergy && String(rec.allergy).trim()) L.push(`แพ้ยา/สาร: ${rec.allergy}`);

  // ความเสี่ยง
  if (typeof fnRisk === "function") {
    const r = fnRisk(rec);
    const facts = (r.factors || []).map((f) => (f && typeof f === "object" ? (f.t || f.label || "") : f)).filter(Boolean);
    L.push(`คะแนนความเสี่ยง: ${r.score} (${r.band})${facts.length ? " — ปัจจัย: " + facts.join("; ") : ""}`);
  }
  // แนวโน้ม eGFR
  if (typeof fnProg === "function" && rec.hn) {
    const p = fnProg(records, rec.hn);
    if (p) L.push(`แนวโน้ม eGFR: ${p.label} (${p.from}→${p.to} ใน ${p.days} วัน, ${p.visits} ครั้ง)${p.stageWorsened ? " — stage แย่ลง" : ""}`);
  }
  if (typeof fnPred === "function" && rec.hn) {
    const pr = fnPred(records, rec.hn);
    if (pr && pr.declining) {
      const t = pr.monthsTo15 || pr.monthsTo30;
      L.push(`คาดการณ์ (linear regression): eGFR ลด ${Math.abs(pr.perYear)}/ปี${t && t <= 60 ? ` — คาดถึง ${pr.monthsTo15 ? "Stage 5" : "Stage 4"} ใน ~${t} เดือน` : ""}`);
    }
  }
  // เกณฑ์ส่งต่อ KDIGO
  if (typeof fnKdigo === "function") {
    const k = fnKdigo(rec, records || []);
    if (k && k.length) L.push(`⚑ เข้าเกณฑ์ส่งต่อแพทย์เฉพาะทางไต (KDIGO 2022): ${k.join("; ")}`);
  }

  // ยาปัจจุบัน + ความปลอดภัยตามไต
  const meds = (rec.meds || []).filter((m) => m.drug && String(m.drug).trim());
  if (meds.length) {
    L.push(`รายการยา (${meds.length} รายการ):`);
    meds.forEach((m) => {
      let s = `  - ${m.drug}${m.strength ? " " + m.strength : ""}${m.dose ? " (" + m.dose + ")" : ""}`;
      if (m.sameAsPrescribed === false) s += " [ใช้จริงไม่ตรงสั่ง]";
      const ci = typeof fnCI === "function" ? fnCI(m.drug, rec.egfr) : null;
      const da = typeof fnDA === "function" ? fnDA(m.drug, rec.egfr) : null;
      if (ci) s += `  ⚠️[${ci.level}] ${ci.message}`;
      else if (da) s += `  ⚠️[${da.level}] ${da.message}`;
      L.push(s);
    });
  } else { L.push("รายการยา: ไม่มี"); }

  // OTC / สมุนไพร
  const otc = (rec.otcItems || []).filter((o) => o && (o.name || o.dose));
  if (otc.length) L.push(`ยา OTC/สมุนไพร: ${otc.map((o) => `${o.name || "-"}${o.dose ? " " + o.dose : ""}`).join(", ")}`);
  else if (rec.otcHerbal) L.push(`ยา OTC/สมุนไพร: ${rec.otcDetail || "มี (ไม่ระบุ)"}`);

  // อันตรกิริยา (DDI)
  const drugNames = meds.map((m) => m.drug);
  const ddi = typeof fnDDI === "function" ? fnDDI(drugNames) : [];
  if (ddi && ddi.length) {
    L.push(`อันตรกิริยาระหว่างยา (${ddi.length} คู่):`);
    ddi.forEach((d) => L.push(`  - [${d.severity}] ${d.drugA} + ${d.drugB}: ${d.message}`));
  }

  // DRP / การแทรกแซง / ผลลัพธ์
  const drpLabels = (rec.drps || []).map((k) => (DRP_OPT.find((o) => o.key === k) || {}).th || k).filter(Boolean);
  if (drpLabels.length) L.push(`ปัญหาจากการใช้ยา (DRP) ที่บันทึก: ${drpLabels.join(", ")}`);
  const intLabels = (rec.interventions || []).map((k) => (INT_OPT.find((o) => o.key === k) || {}).th || k).filter(Boolean);
  if (intLabels.length) L.push(`การแทรกแซงของเภสัชกร: ${intLabels.join(", ")}`);
  const srcLabels = (rec.sources || []).map((k) => (SRC_OPT.find((o) => o.key === k) || {}).th || k).filter(Boolean);
  if (srcLabels.length) L.push(`แหล่งข้อมูล: ${srcLabels.join(", ")}`);
  if (rec.outcome) L.push(`ผลลัพธ์: ${rec.outcome === "accepted" ? "แพทย์ยอมรับ/แก้ไขแล้ว" : "ยังไม่แก้ไข" + (rec.outcomeReason ? " — " + rec.outcomeReason : "")}`);

  return L.join("\n");
}

/* รวมภาพรวมคลินิก → context string สำหรับ AI วิเคราะห์ทั้งระบบ */
function buildClinicContext(scope, records) {
  const latestFn = window.latestPerPatient, fnRisk = window.computeRisk;
  const fnPred = window.predictEgfr, fnKdigo = window.kdigoReferralCheck, fnProg = window.medProgression;
  const DRP_OPT = window.DRP_OPTIONS || [];
  const latest = (typeof latestFn === "function" ? latestFn(scope) : scope).map((r) => ({
    ...r, _risk: typeof fnRisk === "function" ? fnRisk(r) : { band: "low", score: 0 },
  }));
  const L = [];
  L.push(`จำนวนผู้ป่วยทั้งหมด: ${latest.length} ราย | จำนวน visit สะสม: ${(scope || []).length}`);

  const band = { high: 0, medium: 0, low: 0 };
  latest.forEach((r) => { band[r._risk.band] = (band[r._risk.band] || 0) + 1; });
  L.push(`การกระจายความเสี่ยง: เสี่ยงสูง ${band.high} · ปานกลาง ${band.medium} · ต่ำ ${band.low}`);

  // CKD stage distribution
  const stageCount = {};
  latest.forEach((r) => { const s = r.ckdStage || "?"; stageCount[s] = (stageCount[s] || 0) + 1; });
  L.push(`CKD stage: ${Object.entries(stageCount).map(([s, n]) => `G${s}=${n}`).join(", ")}`);

  // Top DRPs
  const drpCount = {};
  (scope || []).forEach((r) => (r.drps || []).forEach((k) => { drpCount[k] = (drpCount[k] || 0) + 1; }));
  const topDrp = Object.entries(drpCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => `${(DRP_OPT.find((o) => o.key === k) || {}).th || k} (${n})`);
  if (topDrp.length) L.push(`DRP ที่พบบ่อย: ${topDrp.join(", ")}`);

  // ผู้ป่วยเข้าเกณฑ์ส่งต่อ
  if (typeof fnKdigo === "function") {
    const refer = latest.filter((r) => { const k = fnKdigo(r, records || []); return k && k.length; });
    if (refer.length) L.push(`ผู้ป่วยเข้าเกณฑ์ส่งต่อแพทย์เฉพาะทาง (KDIGO): ${refer.length} ราย — ${refer.slice(0, 12).map((r) => `${r.name || r.hn} (eGFR ${r.egfr || "?"})`).join(", ")}`);
  }
  // ผู้ป่วย eGFR ลดเร็ว
  if (typeof fnProg === "function") {
    const rapid = latest.map((r) => ({ r, p: fnProg(records || [], r.hn) })).filter((x) => x.p && x.p.level === "rapid");
    if (rapid.length) L.push(`ผู้ป่วย eGFR ลดเร็ว (≥5/ปี): ${rapid.length} ราย — ${rapid.slice(0, 12).map((x) => `${x.r.name || x.r.hn} (${x.p.label})`).join(", ")}`);
  }
  // DRP ค้างแก้
  let pending = 0, resolved = 0;
  (scope || []).forEach((r) => { const fu = r.drpFollowup || {}; (r.drps || []).forEach((k) => { fu[k] === "resolved" ? resolved++ : pending++; }); });
  L.push(`สถานะ DRP: แก้ไขแล้ว ${resolved} · ยังไม่ปิด ${pending}`);

  return L.join("\n");
}

/* ── โหมดผู้ช่วยเภสัชกร ── */
const AI_PATIENT_MODES = [
  {
    key: "doctor", emoji: "🩺", label: "สรุปสำหรับแพทย์",
    system: "คุณคือเภสัชกรคลินิกผู้เชี่ยวชาญด้านโรคไตเรื้อรัง (CKD) เขียนสรุปกระชับ ตรงประเด็น เป็นภาษาไทยทางการแพทย์ สำหรับส่งต่อแพทย์ผู้ดูแล อ้างอิงหลักฐานเชิงตัวเลขจากข้อมูลที่ให้เท่านั้น ห้ามเดาข้อมูลที่ไม่มี",
    instruct: "สรุปเป็น bullet ไม่เกิน 6 ข้อ: (1) สถานะไต/แนวโน้ม (2) ปัญหายาสำคัญและความเสี่ยง (DDI/ข้อห้าม/ปรับขนาดตามไต) (3) สิ่งที่ทำไปแล้ว (4) ข้อเสนอแนะถึงแพทย์ หากเข้าเกณฑ์ KDIGO ให้ระบุชัดว่าควรส่งต่อ",
  },
  {
    key: "care", emoji: "📋", label: "แผนบริบาลเภสัชกรรม",
    system: "คุณคือเภสัชกรคลินิก CKD จัดทำแผนการบริบาลทางเภสัชกรรม (Pharmaceutical Care Plan) ที่ปฏิบัติได้จริง อิงหลักฐานและข้อมูลที่ให้ ภาษาไทย",
    instruct: "เขียนแผนบริบาลแบบ SOAP สั้น ๆ: ปัญหาที่ระบุ (Assessment), เป้าหมายการรักษา, แผนการแทรกแซง (Plan) เรียงตามความสำคัญ, และแผนติดตาม (Monitoring) ระบุค่าที่ต้องเฝ้าระวังและความถี่",
  },
  {
    key: "safety", emoji: "🛡️", label: "ตรวจความปลอดภัยยาเชิงลึก",
    system: "คุณคือเภสัชกรผู้เชี่ยวชาญด้านความปลอดภัยการใช้ยาในผู้ป่วยโรคไต วิเคราะห์เชิงลึกเรื่อง DDI การปรับขนาดยาตาม eGFR ยาที่ควรหลีกเลี่ยง และ nephrotoxicity ภาษาไทย",
    instruct: "ตรวจสอบความปลอดภัยยาทุกตัว: (1) ยาที่ต้องปรับขนาด/หยุดตาม eGFR พร้อมขนาดที่แนะนำ (2) อันตรกิริยาที่ต้องจัดการ (3) ยาที่ควรเปลี่ยนเป็นทางเลือกที่ปลอดภัยกว่า ระบุเหตุผลและคำแนะนำเชิงปฏิบัติทุกข้อ",
  },
  {
    key: "counsel", emoji: "💬", label: "คำแนะนำสำหรับผู้ป่วย",
    system: "คุณคือเภสัชกรที่ให้คำแนะนำผู้ป่วยโรคไต ใช้ภาษาไทยที่เข้าใจง่าย เป็นกันเอง ไม่ใช้ศัพท์แพทย์ที่ซับซ้อน เหมาะกับผู้ป่วยและญาติ",
    instruct: "เขียนคำแนะนำสำหรับผู้ป่วย: วิธีกินยาที่ถูกต้อง ข้อควรระวัง อาหาร/พฤติกรรมที่ควรทำและหลีกเลี่ยงสำหรับโรคไต และอาการเตือนที่ต้องรีบพบแพทย์ ใช้ภาษาง่าย ๆ",
  },
];

/* ── ตัวชี้วัดการบริบาลทางเภสัชกรรม (Pharmaceutical Care KPIs) ── */
function computePharmKpis(scope, records) {
  const latestFn = window.latestPerPatient;
  const latest = typeof latestFn === "function" ? latestFn(scope) : scope;
  const visits = scope || [];
  const nVisits = visits.length || 1;

  // DRP ต่อ visit
  const totalDrp = visits.reduce((a, r) => a + (r.drps || []).length, 0);
  const drpPerVisit = (totalDrp / nVisits).toFixed(1);

  // Intervention acceptance rate
  const withOutcome = visits.filter((r) => r.outcome);
  const accepted = withOutcome.filter((r) => r.outcome === "accepted").length;
  const acceptRate = withOutcome.length ? Math.round((accepted / withOutcome.length) * 100) : 0;

  // Polypharmacy (ผู้ป่วยที่ใช้ยา ≥5 รายการ ใน visit ล่าสุด)
  const polyN = latest.filter((r) => (r.meds || []).filter((m) => m.drug && String(m.drug).trim()).length >= 5).length;
  const polyRate = latest.length ? Math.round((polyN / latest.length) * 100) : 0;

  // Medication adherence issue (มียาที่ใช้จริงไม่ตรงสั่ง ใน visit ล่าสุด)
  const nonAdhereN = latest.filter((r) => (r.meds || []).some((m) => m.drug && m.sameAsPrescribed === false)).length;
  const adhereRate = latest.length ? Math.round(((latest.length - nonAdhereN) / latest.length) * 100) : 0;

  // ค่าเฉลี่ยจำนวนยาต่อผู้ป่วย
  const medCounts = latest.map((r) => (r.meds || []).filter((m) => m.drug && String(m.drug).trim()).length);
  const avgMeds = medCounts.length ? (medCounts.reduce((a, b) => a + b, 0) / medCounts.length).toFixed(1) : "0";

  // DRP resolution rate (จาก drpFollowup)
  let resolved = 0, totalFu = 0;
  visits.forEach((r) => { const fu = r.drpFollowup || {}; (r.drps || []).forEach((k) => { totalFu++; if (fu[k] === "resolved") resolved++; }); });
  const resolveRate = totalFu ? Math.round((resolved / totalFu) * 100) : 0;

  return { drpPerVisit, acceptRate, accepted, withOutcome: withOutcome.length, polyN, polyRate,
    nonAdhereN, adhereRate, avgMeds, resolveRate, resolved, totalFu, totalDrp };
}

Object.assign(window, {
  AI_MODEL, getClaudeKey, setClaudeKey, callClaudeStream,
  buildPatientContext, buildClinicContext, AI_PATIENT_MODES, computePharmKpis,
});
