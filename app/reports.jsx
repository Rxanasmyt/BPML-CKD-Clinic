/* =========================================================================
   reports.jsx — Monthly Reports: สถิติรายเดือน + Export CSV
   ========================================================================= */

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function ReportsPage({ records, user }) {
  const today = new Date();
  const [selYear, setSelYear] = React.useState(today.getFullYear());
  const [selMonth, setSelMonth] = React.useState(today.getMonth() + 1); // 1-indexed

  // Filter records for selected month
  const monthStr = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const monthRecords = records.filter((r) => r.date && r.date.startsWith(monthStr));

  // Statistics
  const totalRecords = monthRecords.length;
  const uniquePatients = new Set(monthRecords.map((r) => r.hn)).size;

  // DRP counts by type
  const drpCounts = {};
  DRP_OPTIONS.forEach((o) => { drpCounts[o.key] = 0; });
  monthRecords.forEach((r) => { (r.drps || []).forEach((k) => { if (drpCounts[k] !== undefined) drpCounts[k]++; }); });

  // Intervention acceptance rate
  const withIntervention = monthRecords.filter((r) => (r.interventions || []).length > 0);
  const accepted = withIntervention.filter((r) => r.outcome === "accepted").length;
  const acceptRate = withIntervention.length > 0 ? Math.round((accepted / withIntervention.length) * 100) : null;

  // Pharmacist breakdown
  const pharmCounts = {};
  monthRecords.forEach((r) => {
    const p = r.pharmacist || "ไม่ระบุ";
    pharmCounts[p] = (pharmCounts[p] || 0) + 1;
  });

  // Generate year options (last 5 years)
  const yearOpts = [];
  for (let y = today.getFullYear(); y >= today.getFullYear() - 4; y--) yearOpts.push(y);

  function exportCSV() {
    const headers = ["id", "date", "hn", "name", "age", "ckdStage", "egfr", "scr", "k", "na", "hb", "hco3", "phos", "ca", "uacr", "dm", "bpSys", "bpDia", "hr", "allergy", "drps", "drpDetail", "discrepancy", "discrepancyType", "interventions", "outcome", "pharmacist", "physician"];
    const rows = monthRecords.map((r) => headers.map((h) => {
      const v = r[h];
      if (Array.isArray(v)) return '"' + v.join("; ").replace(/"/g, '""') + '"';
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
    }));
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ckd_report_${monthStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const kpiStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", textAlign: "center" };
  const kpiNum = { fontFamily: "var(--mono)", fontSize: 32, fontWeight: 800, color: "var(--brand)" };
  const kpiLabel = { fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 };

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1100, margin: "0 auto" }}>
      <PageHead
        title="รายงานรายเดือน"
        sub="Monthly Reports"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => window.print()} className="no-print" style={{ ...primaryBtn, background: "var(--brand)" }}>
              <Icon name="download" size={18} color="#fff" />พิมพ์ / PDF
            </button>
            <button onClick={exportCSV} className="no-print" style={{ ...primaryBtn, background: "#16a34a" }}>
              <Icon name="download" size={18} color="#fff" />Export CSV
            </button>
          </div>
        }
      />

      {/* Month/Year selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>เดือน:</label>
        <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)", cursor: "pointer", outline: "none" }}>
          {TH_MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <label style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>ปี:</label>
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)", cursor: "pointer", outline: "none" }}>
          {yearOpts.map((y) => <option key={y} value={y}>{y + 543} ({y})</option>)}
        </select>
        <span style={{ fontSize: 13, color: "var(--ink-2)", marginLeft: 8 }}>
          {TH_MONTHS_SHORT[selMonth - 1]} {selYear + 543} · {totalRecords} บันทึก
        </span>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
        <div style={kpiStyle}>
          <div style={kpiNum}>{totalRecords}</div>
          <div style={kpiLabel}>บันทึกทั้งหมด</div>
        </div>
        <div style={kpiStyle}>
          <div style={kpiNum}>{uniquePatients}</div>
          <div style={kpiLabel}>ผู้ป่วยไม่ซ้ำ</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ ...kpiNum, color: "#dc2626" }}>{monthRecords.filter((r) => (r.drps || []).length > 0).length}</div>
          <div style={kpiLabel}>records ที่พบ DRP</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ ...kpiNum, color: acceptRate === null ? "var(--ink-2)" : acceptRate >= 70 ? "#16a34a" : "#d97706" }}>
            {acceptRate !== null ? acceptRate + "%" : "–"}
          </div>
          <div style={kpiLabel}>อัตราแก้ไข DRP</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ ...kpiNum, color: "#7c3aed" }}>{monthRecords.filter((r) => r.discrepancy === "found").length}</div>
          <div style={kpiLabel}>พบความคลาดเคลื่อน</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }} className="reports-grid">
        {/* DRP breakdown */}
        <Card title="DRP ที่พบ (แยกประเภท)" icon="alert">
          {DRP_OPTIONS.some((o) => drpCounts[o.key] > 0) ? (
            <HBars
              data={DRP_OPTIONS.filter((o) => drpCounts[o.key] > 0).map((o) => ({ label: o.th, value: drpCounts[o.key], color: "#dc2626" }))}
              color="#dc2626"
              maxLabel={180}
            />
          ) : <Empty text="ไม่มี DRP ในเดือนนี้" />}
        </Card>

        {/* Pharmacist breakdown */}
        <Card title="บันทึกแยกตามเภสัชกร" icon="user">
          {Object.keys(pharmCounts).length > 0 ? (
            <HBars
              data={Object.entries(pharmCounts).map(([k, v]) => ({ label: k, value: v, color: "var(--brand)" }))}
              maxLabel={200}
            />
          ) : <Empty text="ไม่มีข้อมูล" />}
        </Card>
      </div>

      {/* Records table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="list" size={16} color="var(--brand-deep)" />
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", margin: 0 }}>รายการบันทึกทั้งหมด ({monthRecords.length} รายการ)</h3>
        </div>
        {monthRecords.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["วันที่", "HN", "ชื่อ", "ระยะ CKD", "eGFR", "K⁺", "DRP", "ความเสี่ยง", "ผลลัพธ์", "เภสัชกร"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--ink-2)", fontSize: 12, textTransform: "uppercase", letterSpacing: .3, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...monthRecords].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((r, i) => {
                  const rk = computeRisk(r);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)" }}>{r.hn}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--ink)" }}>{r.name}</td>
                      <td style={{ padding: "10px 12px" }}><StagePill stage={r.ckdStage} /></td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", textAlign: "right", color: r.egfr && Number(r.egfr) < 30 ? "#dc2626" : "var(--ink)" }}>{r.egfr || "–"}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", textAlign: "right", color: r.k && Number(r.k) > 5.5 ? "#dc2626" : "var(--ink)" }}>{r.k || "–"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {(r.drps || []).length > 0 ? <span style={{ color: "#dc2626", fontWeight: 700 }}>{r.drps.length}</span> : <span style={{ color: "var(--ink-2)" }}>–</span>}
                      </td>
                      <td style={{ padding: "10px 12px" }}><RiskBadge band={rk.band} score={rk.score} small /></td>
                      <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: r.outcome === "accepted" ? "#16a34a" : r.outcome === "not_accepted" ? "#b91c1c" : "var(--ink-2)" }}>
                        {r.outcome === "accepted" ? "แก้ไขแล้ว" : r.outcome === "not_accepted" ? "ไม่แก้ไข" : "–"}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-2)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pharmacist || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={`ไม่มีบันทึกในเดือน ${TH_MONTHS_SHORT[selMonth - 1]} ${selYear + 543}`} />
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ReportsPage });
