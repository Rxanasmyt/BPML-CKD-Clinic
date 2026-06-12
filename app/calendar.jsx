/* =========================================================================
   calendar.jsx — Follow-up Calendar: แสดงนัดติดตามผู้ป่วยรายเดือน
   ========================================================================= */

const TH_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTHS_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function FollowUpCalendar({ records, onOpenPatient }) {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth()); // 0-indexed

  // Build a map: "YYYY-MM-DD" -> [{ hn, name, due }]
  // ใช้ visit ล่าสุดของแต่ละผู้ป่วยเท่านั้น — กัน follow-up เก่าค้างในปฏิทิน
  const dueMap = React.useMemo(() => {
    const map = {};
    latestPerPatient(records).forEach((r) => {
      if (r.followUp && r.followUp.due) {
        const key = r.followUp.due; // expected "YYYY-MM-DD"
        if (!map[key]) map[key] = [];
        map[key].push({ hn: r.hn, name: r.name, due: r.followUp.due });
      }
    });
    return map;
  }, [records]);

  // Generate calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  // Pad with nulls before first day
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function navMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  }

  function fmtKey(d) {
    if (!d) return null;
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${viewYear}-${mm}-${dd}`;
  }

  function chipColor(due) {
    const todayStr = todayISO();
    if (due < todayStr) return { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" };
    if (due === todayStr) return { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" };
    return { bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" };
  }

  const todayStr = todayISO();

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 1100, margin: "0 auto" }}>
      <PageHead
        title="ปฏิทินนัดติดตาม"
        sub="Follow-up Calendar"
        action={null}
      />

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button onClick={() => navMonth(-1)} style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="chevron" size={18} color="var(--ink-2)" style={{ transform: "rotate(90deg)" }} />
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0, flex: 1, textAlign: "center" }}>
          {TH_MONTHS_LONG[viewMonth]} {viewYear + 543}
        </h2>
        <button onClick={() => navMonth(1)} style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="chevronR" size={18} color="var(--ink-2)" />
        </button>
        <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--brand-deep)", fontFamily: "var(--sans)" }}>
          วันนี้
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--border)" }}>
          {TH_WEEKDAYS.map((d, i) => (
            <div key={i} style={{
              padding: "10px 4px", textAlign: "center", fontSize: 12.5, fontWeight: 700,
              color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : "var(--ink-2)",
              background: "var(--surface-2)",
              borderRight: i < 6 ? "1px solid var(--border)" : "none",
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <div key={row} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: row < cells.length / 7 - 1 ? "1px solid var(--border)" : "none" }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, col) => {
              const key = fmtKey(d);
              const patients = key ? (dueMap[key] || []) : [];
              const isToday = key === todayStr;
              return (
                <div key={col} style={{
                  minHeight: 90, padding: "8px 8px 6px",
                  background: isToday ? "var(--brand-soft)" : "transparent",
                  borderRight: col < 6 ? "1px solid var(--border)" : "none",
                  verticalAlign: "top",
                }}>
                  {d != null && (
                    <>
                      <div style={{
                        fontSize: 13, fontWeight: isToday ? 800 : 500,
                        color: isToday ? "var(--brand-deep)" : col === 0 ? "#dc2626" : col === 6 ? "#2563eb" : "var(--ink)",
                        marginBottom: 5,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: isToday ? 26 : "auto", height: isToday ? 26 : "auto",
                        borderRadius: isToday ? "50%" : 0,
                        background: isToday ? "var(--brand)" : "transparent",
                        color: isToday ? "#fff" : undefined,
                      }}>{d}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {patients.map((p, i) => {
                          const cc = chipColor(p.due);
                          return (
                            <button key={i} onClick={() => onOpenPatient(p.hn)}
                              style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "3px 7px", borderRadius: 6,
                                background: cc.bg, border: `1px solid ${cc.border}`,
                                cursor: "pointer", fontFamily: "var(--sans)",
                              }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: cc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: cc.text, opacity: 0.8, fontFamily: "var(--mono)" }}>HN {p.hn}</div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12.5, flexWrap: "wrap" }}>
        {[
          { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", label: "เกินกำหนด (Overdue)" },
          { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "วันนี้ (Today)" },
          { bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e", label: "นัดในอนาคต (Upcoming)" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: item.bg, border: `1px solid ${item.border}` }} />
            <span style={{ color: "var(--ink-2)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { FollowUpCalendar });
