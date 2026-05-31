/* =========================================================================
   dashboard.jsx — สรุปภาพรวม, KPI, กราฟ, รายชื่อผู้ป่วยเสี่ยงสูง
   ========================================================================= */
function latestPerPatient(records) {
  const map = {};
  records.forEach((r) => {
    if (!map[r.hn] || (r.date || "") > (map[r.hn].date || "")) map[r.hn] = r;
  });
  return Object.values(map);
}

function Dashboard({ records, user, onOpenPatient, onNew, onGoPatients }) {
  const scope = user.role === "admin" ? records : records.filter((r) => r.createdBy === user.id);
  const latest = latestPerPatient(scope).map((r) => ({ ...r, risk: computeRisk(r) }));

  const total = latest.length;
  const riskCounts = { high: 0, medium: 0, low: 0 };
  latest.forEach((r) => riskCounts[r.risk.band]++);

  const stageData = CKD_STAGES.map((s) => ({
    label: `ระยะ ${s}`, value: latest.filter((r) => r.ckdStage === s).length,
    color: s === "5" ? "#dc2626" : s === "4" ? "#ea580c" : s === "3b" ? "#d97706" : "var(--brand)",
  })).filter((d) => d.value > 0);

  // DRP breakdown (ทุก record ในขอบเขต)
  const drpCount = {};
  DRP_OPTIONS.forEach((o) => (drpCount[o.key] = 0));
  scope.forEach((r) => (r.drps || []).forEach((k) => (drpCount[k] = (drpCount[k] || 0) + 1)));
  const drpData = DRP_OPTIONS.map((o) => ({ label: o.th, value: drpCount[o.key] }))
    .filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  // intervention accepted rate
  const withOutcome = scope.filter((r) => r.outcome);
  const accepted = scope.filter((r) => r.outcome === "accepted").length;
  const acceptRate = withOutcome.length ? Math.round((accepted / withOutcome.length) * 100) : 0;

  // high-risk follow-up list
  const highList = latest.filter((r) => r.risk.band !== "low")
    .sort((a, b) => b.risk.score - a.risk.score);

  // follow-up due
  const today = "2026-05-29";
  const dueList = scope.filter((r) => r.followUp && r.followUp.due)
    .filter((r) => r.followUp.due <= "2026-06-05")
    .sort((a, b) => (a.followUp.due || "").localeCompare(b.followUp.due || ""));

  // trend (records per week of scope, last 6 buckets)
  const trend = buildTrend(scope);

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1280, margin: "0 auto" }}>
      <PageHead
        title="ภาพรวมคลินิก CKD"
        sub={user.role === "admin" ? "ข้อมูลทั้งคลินิก (ทุกเภสัชกร)" : `ข้อมูลที่บันทึกโดย ${user.name}`}
        action={<button onClick={onNew} style={primaryBtn}><Icon name="plus" size={18} color="#fff" />บันทึกผู้ป่วยใหม่</button>}
      />

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 16 }}>
        <Kpi label="ผู้ป่วยทั้งหมด" value={total} unit="ราย" icon="patients" />
        <Kpi label="เสี่ยงสูง — ติดตามด่วน" value={riskCounts.high} unit="ราย" icon="alert" tone="danger" onClick={onGoPatients} />
        <Kpi label="อัตราแก้ไขสำเร็จ" value={acceptRate} unit="%" icon="check" tone="ok" sub={`${accepted}/${withOutcome.length} ครั้ง`} />
        <Kpi label="นัดติดตาม (7 วัน)" value={dueList.length} unit="ราย" icon="clock" tone="warn" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }} className="dash-grid">
        {/* Risk donut */}
        <Card title="การจัดลำดับความเสี่ยง" icon="shield">
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <Donut center={total} segments={[
              { value: riskCounts.high, color: "#dc2626" },
              { value: riskCounts.medium, color: "#d97706" },
              { value: riskCounts.low, color: "#16a34a" },
            ]} />
            <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 12 }}>
              {[["high", riskCounts.high], ["medium", riskCounts.medium], ["low", riskCounts.low]].map(([b, n]) => {
                const m = RISK_META[b];
                return (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: m.color }} />
                    <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{m.th}</span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{n}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-2)", width: 38, textAlign: "right" }}>{total ? Math.round((n / total) * 100) : 0}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* CKD stage */}
        <Card title="แยกตามระยะของโรค (CKD stage)" icon="kidney">
          <HBars data={stageData} maxLabel={64} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }} className="dash-grid">
        {/* DRP breakdown */}
        <Card title="ปัญหาด้านยาที่พบบ่อย (DRP)" icon="pill">
          {drpData.length ? <HBars data={drpData} color="var(--accent)" maxLabel={150} />
            : <Empty text="ยังไม่พบปัญหาด้านยา" />}
        </Card>

        {/* trend */}
        <Card title="แนวโน้มการบันทึกรายสัปดาห์" icon="trend">
          <LineChart points={trend.values} labels={trend.labels} />
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 10 }}>จำนวนการบันทึก BPML ต่อสัปดาห์ (6 สัปดาห์ล่าสุด)</div>
        </Card>
      </div>

      {/* Population Analytics */}
      <PopulationAnalytics scope={scope} records={records} />

      {/* High-risk follow-up table */}
      <Card title="ผู้ป่วยเสี่ยงสูงที่ต้องติดตามด่วน" icon="alert"
        right={<span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{highList.length} ราย</span>}>
        {highList.length ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 90px", gap: 12, padding: "0 4px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid var(--border)" }}>
              <span>ผู้ป่วย</span><span>ระยะ / eGFR</span><span>ความเสี่ยง</span><span>ปัจจัยเสี่ยงหลัก</span><span></span>
            </div>
            {highList.slice(0, 8).map((r) => (
              <div key={r.id} onClick={() => onOpenPatient(r.hn)}
                className="hrow"
                style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 90px", gap: 12, padding: "12px 4px", alignItems: "center", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-2)" }}>HN {r.hn} · {r.age} ปี</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <StagePill stage={r.ckdStage} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-2)" }}>eGFR {r.egfr} · K⁺ {r.k}</span>
                </div>
                <div><RiskBadge band={r.risk.band} score={r.risk.score} /></div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{r.risk.factors.slice(0, 2).map((f) => f.t).join(" · ")}</div>
                <button style={followBtn} onClick={(e) => { e.stopPropagation(); onOpenPatient(r.hn); }}>ดูข้อมูล</button>
              </div>
            ))}
          </div>
        ) : <Empty text="ไม่มีผู้ป่วยเสี่ยงสูงในขณะนี้ 🎉" />}
      </Card>
    </div>
  );
}

/* =========================================================================
   PopulationAnalytics — clinic-wide analytics section
   ========================================================================= */
function PopulationAnalytics({ scope }) {
  // ---- 1. Population eGFR Trend (avg eGFR per month, last 6 months) ----
  const today = new Date("2026-05-29");
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    monthBuckets.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` });
  }

  // latest record per patient per month
  const egfrByMonth = monthBuckets.map(({ year, month }) => {
    const monthRecords = {};
    scope.forEach((r) => {
      if (!r.date || !r.egfr) return;
      const d = new Date(r.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const egfr = parseFloat(r.egfr);
        if (isNaN(egfr)) return;
        if (!monthRecords[r.hn] || r.date > monthRecords[r.hn].date) monthRecords[r.hn] = r;
      }
    });
    const vals = Object.values(monthRecords).map((r) => parseFloat(r.egfr)).filter((v) => !isNaN(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });

  const egfrLabels = monthBuckets.map((b) => b.label);
  const validEgfr = egfrByMonth.filter((v) => v != null);
  const latestAvgEgfr = validEgfr.length ? validEgfr[validEgfr.length - 1] : null;
  const egfrLineColor = latestAvgEgfr == null ? "#16a34a" : latestAvgEgfr >= 60 ? "#16a34a" : latestAvgEgfr >= 30 ? "#d97706" : "#dc2626";

  // SVG eGFR chart with reference lines at 60, 30, 15
  function EgfrTrendSvg() {
    const pts = egfrByMonth;
    const w = 480, padL = 42, padR = 30, padT = 14, padB = 28;
    const chartW = w - padL - padR;
    const chartH = 130 - padT - padB;
    const refVals = [15, 30, 60];
    const allVals = [...pts.filter((v) => v != null), ...refVals];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const span = rawMax - rawMin || 1;
    const minV = rawMin - span * 0.12;
    const maxV = rawMax + span * 0.12;
    const toY = (v) => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;
    const toX = (i) => padL + (pts.length <= 1 ? chartW / 2 : (i / (pts.length - 1)) * chartW);
    const validPts = pts.map((p, i) => ({ v: p, i })).filter((x) => x.v != null);
    const pathD = validPts.map(({ v, i }, idx) => `${idx === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
    const areaD = validPts.length > 1 ? `${pathD} L ${toX(validPts[validPts.length - 1].i).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${toX(validPts[0].i).toFixed(1)} ${(padT + chartH).toFixed(1)} Z` : "";
    const refMeta = [{ v: 60, c: "#16a34a" }, { v: 30, c: "#d97706" }, { v: 15, c: "#dc2626" }];
    return (
      <svg width="100%" viewBox={`0 0 ${w} 130`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="egfr-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={egfrLineColor} stopOpacity=".2" />
            <stop offset="100%" stopColor={egfrLineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* y-axis ticks */}
        {[minV + (maxV - minV) * 0.1, minV + (maxV - minV) * 0.5, maxV - (maxV - minV) * 0.1].map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={toY(t)} y2={toY(t)} stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />
            <text x={padL - 4} y={toY(t)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 9, fill: "var(--ink-2)", fontFamily: "monospace" }}>{Math.round(t)}</text>
          </g>
        ))}
        {/* reference lines */}
        {refMeta.map(({ v, c }) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={toY(v)} y2={toY(v)} stroke={c} strokeWidth="1.4" strokeDasharray="6,4" />
            <text x={w - padR + 4} y={toY(v)} textAnchor="start" dominantBaseline="middle" style={{ fontSize: 9, fill: c, fontFamily: "monospace", fontWeight: 700 }}>{v}</text>
          </g>
        ))}
        {areaD && <path d={areaD} fill="url(#egfr-area-grad)" />}
        {pathD && <path d={pathD} fill="none" stroke={egfrLineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {validPts.map(({ v, i }) => <circle key={i} cx={toX(i)} cy={toY(v)} r="3.5" fill="var(--surface)" stroke={egfrLineColor} strokeWidth="2" />)}
        {egfrLabels.map((l, i) => <text key={i} x={toX(i)} y={127} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-2)", fontFamily: "monospace" }}>{l}</text>)}
      </svg>
    );
  }

  // ---- 2. CKD Progression Tracker ----
  const patientHNs = [...new Set(scope.map((r) => r.hn))];
  let rapidCount = 0, stableCount = 0, improvingCount = 0;
  patientHNs.forEach((hn) => {
    const visits = scope.filter((r) => r.hn === hn && r.egfr && r.date).sort((a, b) => a.date.localeCompare(b.date));
    if (visits.length < 2) return;
    const first = visits[0], last = visits[visits.length - 1];
    const egfrDelta = parseFloat(last.egfr) - parseFloat(first.egfr);
    const daysDiff = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (daysDiff < 1) return;
    const slope = (egfrDelta / daysDiff) * 365; // mL/min/year
    if (slope < -5) rapidCount++;
    else if (slope > 2) improvingCount++;
    else stableCount++;
  });
  const progressTotal = rapidCount + stableCount + improvingCount || 1;

  // ---- 3. DRP Prevalence by Drug Class ----
  const drpClassCount = {};
  DRP_OPTIONS.forEach((o) => { drpClassCount[o.key] = 0; });
  scope.forEach((r) => (r.drps || []).forEach((k) => { drpClassCount[k] = (drpClassCount[k] || 0) + 1; }));
  const drpClassData = DRP_OPTIONS.map((o) => ({ label: o.th, value: drpClassCount[o.key] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ---- 4. High-risk Population Summary ----
  const latestAll = latestPerPatient(scope);
  const prevMonthStart = new Date(today); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const prevMonthStr = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, "0")}`;

  const latestPrevMonth = (() => {
    const map = {};
    scope.forEach((r) => {
      if (!r.date) return;
      const recMonth = r.date.slice(0, 7);
      if (recMonth <= prevMonthStr) {
        if (!map[r.hn] || r.date > map[r.hn].date) map[r.hn] = r;
      }
    });
    return Object.values(map);
  })();

  function countPop(recs) {
    const g5 = recs.filter((r) => parseFloat(r.egfr) < 15 || r.ckdStage === "5").length;
    const hyperK = recs.filter((r) => parseFloat(r.k) > 5.5).length;
    const nephro = recs.filter((r) => {
      if ((r.drps || []).includes("nephrotoxic")) return true;
      return (r.meds || []).some((m) => (m.flags || []).includes("nephrotoxic"));
    }).length;
    const unresolved = recs.filter((r) => r.discrepancy === "found" && r.outcome !== "accepted").length;
    return { g5, hyperK, nephro, unresolved };
  }
  const now = countPop(latestAll);
  const prev = countPop(latestPrevMonth);

  function TrendArrow({ cur, prevVal }) {
    if (prevVal == null || prevVal === 0) return null;
    const diff = cur - prevVal;
    if (diff === 0) return <span style={{ fontSize: 11, color: "var(--ink-2)", marginLeft: 4 }}>—</span>;
    const up = diff > 0;
    return (
      <span style={{ fontSize: 11, color: up ? "#dc2626" : "#16a34a", marginLeft: 4, fontWeight: 700 }}>
        {up ? "▲" : "▼"}{Math.abs(diff)}
      </span>
    );
  }

  const popStats = [
    { label: "eGFR < 15 (G5)", value: now.g5, prev: prev.g5, color: "#dc2626", icon: "kidney" },
    { label: "K⁺ > 5.5", value: now.hyperK, prev: prev.hyperK, color: "#7c3aed", icon: "alert" },
    { label: "Nephrotoxic ≥1 ชนิด", value: now.nephro, prev: prev.nephro, color: "#ea580c", icon: "pill" },
    { label: "Discrepancy ยังไม่แก้", value: now.unresolved, prev: prev.unresolved, color: "#d97706", icon: "shield" },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2, background: "var(--brand)" }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Population Analytics</h2>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)", marginLeft: 4 }}>ภาพรวมระดับคลินิก</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="dash-grid">
        {/* eGFR Trend */}
        <Card title="แนวโน้ม eGFR เฉลี่ย (ทั้งคลินิก)" icon="trend">
          {validEgfr.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color: egfrLineColor }}>{latestAvgEgfr}</span>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>mL/min (เฉลี่ย เดือนล่าสุด)</span>
              </div>
              <EgfrTrendSvg />
              <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                {[{ v: 60, c: "#16a34a", t: "≥60" }, { v: 30, c: "#d97706", t: "30" }, { v: 15, c: "#dc2626", t: "15" }].map(({ v, c, t }) => (
                  <span key={v} style={{ fontSize: 10.5, color: c, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={c} strokeWidth="1.5" strokeDasharray="4,2" /></svg>{t}
                  </span>
                ))}
              </div>
            </>
          ) : <Empty text="ยังไม่มีข้อมูล eGFR" />}
        </Card>

        {/* CKD Progression Tracker */}
        <Card title="CKD Progression Tracker" icon="trend">
          {(rapidCount + stableCount + improvingCount) > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
                <Donut center={rapidCount + stableCount + improvingCount} segments={[
                  { value: rapidCount, color: "#dc2626" },
                  { value: stableCount, color: "#d97706" },
                  { value: improvingCount, color: "#16a34a" },
                ]} size={120} thickness={18} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Rapid progressor (< −5/ปี)", n: rapidCount, c: "#dc2626" },
                    { label: "Stable (−5 ถึง +2/ปี)", n: stableCount, c: "#d97706" },
                    { label: "Improving (> +2/ปี)", n: improvingCount, c: "#16a34a" },
                  ].map(({ label, n, c }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.3 }}>{label}</span>
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)", fontSize: 15 }}>{n}</span>
                      <span style={{ fontSize: 11.5, color: "var(--ink-2)", width: 36, textAlign: "right" }}>{Math.round((n / progressTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>คำนวณจากผู้ป่วยที่มี ≥2 ครั้ง (slope eGFR mL/min/ปี)</div>
            </>
          ) : <Empty text="ต้องการข้อมูล ≥2 ครั้งต่อผู้ป่วย" />}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="dash-grid">
        {/* DRP Prevalence by Drug Class */}
        <Card title="DRP ที่พบบ่อยตามกลุ่มยา (Top 5)" icon="pill">
          {drpClassData.length > 0 ? (
            <HBars data={drpClassData} color="#0e7490" maxLabel={160} />
          ) : <Empty text="ยังไม่พบ DRP" />}
        </Card>

        {/* High-risk Population Summary */}
        <Card title="สรุปกลุ่มเสี่ยงสูง" icon="alert">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {popStats.map(({ label, value, prev: prevVal, color, icon }) => (
              <div key={label} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <Icon name={icon} size={14} color={color} />
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.3 }}>{label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700, color }}>{value}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>ราย</span>
                  <TrendArrow cur={value} prevVal={prevVal} />
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>เดือนก่อน: {prevVal}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildTrend(records) {
  // 6 weekly buckets ending 2026-05-29
  const end = new Date("2026-05-29");
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(end); start.setDate(end.getDate() - i * 7 - 6);
    const stop = new Date(end); stop.setDate(end.getDate() - i * 7);
    buckets.push({ start, stop, n: 0, label: `${stop.getDate()}/${stop.getMonth() + 1}` });
  }
  records.forEach((r) => {
    const d = new Date(r.date);
    buckets.forEach((b) => { if (d >= b.start && d <= b.stop) b.n++; });
  });
  // ใส่ค่าพื้นฐานให้กราฟดูมีชีวิตชีวาเมื่อข้อมูลตัวอย่างน้อย
  const base = [4, 6, 5, 8, 7, 0];
  return { values: buckets.map((b, i) => b.n + (records === SEED_RECORDS ? base[i] : 0)), labels: buckets.map((b) => b.label) };
}

/* ---------- ส่วนประกอบย่อย ---------- */
function PageHead({ title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <h1 style={{ fontSize: "clamp(20px,2.4vw,27px)", fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.3 }}>{title}</h1>
        {sub && <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "6px 0 0", lineHeight: 1.4 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Kpi({ label, value, unit, icon, tone, sub, onClick }) {
  const tones = { danger: "#dc2626", ok: "#16a34a", warn: "#d97706" };
  const c = tones[tone] || "var(--brand)";
  return (
    <div className="card-modern" onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden", borderTop: `3px solid ${c}`, transition: 'transform 0.15s' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500, lineHeight: 1.3, maxWidth: 130 }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: tone ? c + "18" : "var(--brand-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={icon} size={18} color={c} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, icon, right, children }) {
  return (
    <div className="card-modern" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        {icon && <Icon name={icon} size={18} color="var(--brand-deep)" />}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: "26px 0", textAlign: "center", color: "var(--ink-2)", fontSize: 13.5 }}>{text}</div>;
}

const primaryBtn = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 11, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap", flexShrink: 0 };
const followBtn = { padding: "7px 12px", background: "var(--surface-2)", color: "var(--brand-deep)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" };

Object.assign(window, { Dashboard, PageHead, Kpi, Card, Empty, primaryBtn, followBtn, latestPerPatient, PopulationAnalytics });
