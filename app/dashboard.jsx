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
    <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
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

Object.assign(window, { Dashboard, PageHead, Kpi, Card, Empty, primaryBtn, followBtn, latestPerPatient });
