/* =========================================================================
   app.jsx — โครงแอป: Firebase listener, routing, sidebar, Tweaks
   ========================================================================= */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "teal",
  "density": "regular",
  "fontScale": 100,
  "navStyle": "sidebar"
}/*EDITMODE-END*/;

const AUTH_KEY = "pharm_ckd_user_v1";

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => { applyTheme(t.theme, t.density); }, [t.theme, t.density]);
  React.useEffect(() => { document.documentElement.style.fontSize = (16 * t.fontScale / 100) + "px"; }, [t.fontScale]);

  const [user, setUser] = React.useState(() => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; } });
  const [records, setRecords] = React.useState([]);
  const [route, setRoute] = React.useState({ view: "dashboard" });

  /* --- PWA install banner --- */
  const [installPrompt, setInstallPrompt] = React.useState(null);
  const [installBanner, setInstallBanner] = React.useState(false);
  React.useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setInstallPrompt(e);
      setInstallBanner(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);
  function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then(() => { setInstallPrompt(null); setInstallBanner(false); });
  }
  const [changePinOpen, setChangePinOpen] = React.useState(false);
  const [syncState, setSyncState] = React.useState("connecting"); // connecting | synced | syncing | error

  /* --- Firebase realtime listener --- */
  React.useEffect(() => {
    let unsub = null;

    async function startListening() {
      try {
        await Promise.all([FirebaseStore.seed(), FirebaseUserStore.seed()]);
      } catch (e) { /* ignore seed errors */ }
      if (unsub) unsub();
      unsub = FirebaseStore.listen((recs, err) => {
        if (err) setSyncState("error");
        else { setRecords(recs); setSyncState("synced"); }
      });
    }

    startListening();

    // เมื่อ Firebase SDK โหลดเสร็จหลังจากแอปเริ่ม → re-register listener
    function onFirebaseReady() {
      setSyncState("connecting");
      startListening();
    }
    window.addEventListener("firebase-ready", onFirebaseReady);

    return () => {
      if (unsub) unsub();
      window.removeEventListener("firebase-ready", onFirebaseReady);
    };
  }, []);

  function updateCurrentUser(u) { setUser(u); localStorage.setItem(AUTH_KEY, JSON.stringify(u)); }
  function login(u) { updateCurrentUser(u); setRoute({ view: "dashboard" }); }
  function logout() { setUser(null); localStorage.removeItem(AUTH_KEY); }

  async function saveRecord(rec) {
    setSyncState("syncing");
    try {
      const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const saved = await FirebaseStore.save({ ...rec, time });
      setRoute({ view: "patient", hn: saved.hn });
    } catch (e) {
      // offline fallback: localStorage
      const saved = Store.save({ ...rec });
      setRecords(Store.all());
      setRoute({ view: "patient", hn: saved.hn });
    }
    setTimeout(() => setSyncState("synced"), 900);
  }

  const themePanel = (
    <TweaksPanel>
      <TweakSection label="แนวทางการออกแบบ (Variations)" />
      <TweakRadio label="โทนสี" value={t.theme} onChange={(v) => setTweak("theme", v)}
        options={[{ value: "teal", label: "Teal" }, { value: "navy", label: "Navy" }, { value: "soft", label: "Soft" }, { value: "dark", label: "Dark" }]} />
      <TweakRadio label="ตำแหน่งเมนู" value={t.navStyle} onChange={(v) => setTweak("navStyle", v)}
        options={[{ value: "sidebar", label: "ด้านข้าง" }, { value: "top", label: "ด้านบน" }]} />
      <TweakSection label="ความหนาแน่น & ตัวอักษร" />
      <TweakRadio label="ความหนาแน่น" value={t.density} onChange={(v) => setTweak("density", v)}
        options={[{ value: "compact", label: "แน่น" }, { value: "regular", label: "ปกติ" }, { value: "comfy", label: "โปร่ง" }]} />
      <TweakSlider label="ขนาดตัวอักษร" value={t.fontScale} min={85} max={120} step={5} unit="%" onChange={(v) => setTweak("fontScale", v)} />
      <TweakSection label="ข้อมูลทดลอง" />
      <TweakButton label="รีเซ็ตข้อมูลตัวอย่าง" onClick={async () => { setSyncState("syncing"); await FirebaseStore.reset(); }} />
    </TweaksPanel>
  );

  if (!user) return <><LoginScreen onLogin={login} />{themePanel}</>;

  const scope = user.role === "admin" ? records : records.filter((r) => r.createdBy === user.id);
  const dueFollow = scope.filter((r) => r.followUp && r.followUp.due && r.followUp.due <= "2026-06-05")
    .sort((a, b) => (a.followUp.due || "").localeCompare(b.followUp.due || ""));

  let page;
  if (route.view === "dashboard")
    page = <Dashboard records={records} user={user} onNew={() => setRoute({ view: "form" })}
      onOpenPatient={(hn) => setRoute({ view: "patient", hn })} onGoPatients={() => setRoute({ view: "patients" })} />;
  else if (route.view === "patients")
    page = <PatientsList records={records} user={user} onNew={() => setRoute({ view: "form" })}
      onOpenPatient={(hn) => setRoute({ view: "patient", hn })} />;
  else if (route.view === "patient")
    page = <PatientDetail hn={route.hn} records={records} user={user} onBack={() => setRoute({ view: "patients" })}
      onEdit={(rec) => setRoute({ view: "form", editing: rec })}
      onNew={(p) => setRoute({ view: "form", editing: { hn: p.hn, name: p.name, age: p.age, ckdStage: p.ckdStage, allergy: p.allergy, date: "2026-05-29", meds: [], sources: [], drps: [], interventions: [], comparedPrev: false, comparedNew: false, discrepancy: "none", id: undefined } })} />;
  else if (route.view === "settings")
    page = <SettingsPage currentUser={user} onUserUpdated={updateCurrentUser} />;
  else if (route.view === "form")
    page = <BpmlForm initial={route.editing} user={user} records={records} onSave={saveRecord} onCancel={() => setRoute({ view: route.editing?.id ? "patient" : "dashboard", hn: route.editing?.hn })} />;
  else if (route.view === "calendar")
    page = <FollowUpCalendar records={records} onOpenPatient={(hn) => setRoute({ view: "patient", hn })} />;
  else if (route.view === "reports")
    page = <ReportsPage records={records} user={user} />;

  const nav = [
    { v: "dashboard", icon: "dashboard", label: "ภาพรวม" },
    { v: "patients", icon: "patients", label: "ผู้ป่วย" },
    { v: "calendar", icon: "clock", label: "ปฏิทินนัด" },
    { v: "form", icon: "plus", label: "บันทึกใหม่" },
    ...(user.role === "admin" ? [
      { v: "reports", icon: "trend", label: "รายงาน" },
      { v: "settings", icon: "shield", label: "จัดการบัญชี" },
    ] : []),
  ];
  const sideMode = t.navStyle === "sidebar";

  return (
    <div style={{ minHeight: "100vh", display: sideMode ? "flex" : "block", background: "var(--bg)", fontFamily: "var(--sans)", color: "var(--ink)" }}>
      {changePinOpen && <ChangePinModal user={user} onClose={() => setChangePinOpen(false)} onUpdated={updateCurrentUser} />}
      {sideMode ? (
        <aside className="sidebar" style={{ width: 232, background: "var(--sidebar)", color: "var(--sidebar-ink)", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <Brand />
          <nav style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {nav.map((n) => <NavItem key={n.v} n={n} active={route.view === n.v || (n.v === "patients" && route.view === "patient")} onClick={() => setRoute({ view: n.v })} side />)}
          </nav>
          <UserCard user={user} onLogout={logout} onChangePin={() => setChangePinOpen(true)} side />
        </aside>
      ) : (
        <header style={{ background: "var(--sidebar)", color: "var(--sidebar-ink)", display: "flex", alignItems: "center", padding: "0 18px", gap: 8, position: "sticky", top: 0, zIndex: 30 }}>
          <Brand topbar />
          <nav style={{ display: "flex", gap: 4, flex: 1, marginLeft: 20 }}>
            {nav.map((n) => <NavItem key={n.v} n={n} active={route.view === n.v || (n.v === "patients" && route.view === "patient")} onClick={() => setRoute({ view: n.v })} />)}
          </nav>
          <UserCard user={user} onLogout={logout} onChangePin={() => setChangePinOpen(true)} compact />
        </header>
      )}

      <main style={{ flex: 1, minWidth: 0 }}>
        <TopBar syncState={syncState} dueFollow={dueFollow} user={user} onOpenPatient={(hn) => setRoute({ view: "patient", hn })} />
        {syncState === "connecting" && records.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16, color: "var(--ink-2)" }}>
            <div style={{ width: 40, height: 40, border: "3.5px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <span style={{ fontSize: 15 }}>กำลังเชื่อมต่อ Firebase...</span>
          </div>
        ) : page}
      </main>
      {themePanel}
      {installBanner && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
          background: "#0d9488", color: "#fff",
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px clamp(16px, 4vw, 28px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,.22)",
          fontFamily: "var(--sans)", fontSize: 14,
        }}>
          <span style={{ flex: 1, fontWeight: 500 }}>📲 ติดตั้ง PHARM-CKD บนหน้าจอหลักของคุณ</span>
          <button onClick={handleInstall} style={{
            background: "#fff", color: "#0d6e68", border: "none", borderRadius: 8,
            padding: "8px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
            fontFamily: "var(--sans)", flexShrink: 0,
          }}>ติดตั้ง</button>
          <button onClick={() => setInstallBanner(false)} style={{
            background: "rgba(255,255,255,.18)", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
            fontFamily: "var(--sans)", flexShrink: 0,
          }}>ปิด</button>
        </div>
      )}
    </div>
  );
}

function Brand({ topbar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: topbar ? "0" : "20px 18px", height: topbar ? 58 : "auto" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sidebar-active)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name="kidney" size={22} color="#fff" />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.1 }}>PHARM-CKD</div>
        <div style={{ fontSize: 10.5, opacity: .6, letterSpacing: 1 }}>BPML CLINIC</div>
      </div>
    </div>
  );
}

function NavItem({ n, active, onClick, side }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 11, padding: side ? "11px 14px" : "9px 14px", borderRadius: 10,
      border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 14, fontWeight: active ? 700 : 500,
      width: side ? "100%" : "auto", textAlign: "left",
      background: active ? "var(--sidebar-active)" : "transparent",
      color: active ? "#fff" : "var(--sidebar-ink)",
    }}>
      <Icon name={n.icon} size={19} color={active ? "#fff" : "currentColor"} />{n.label}
    </button>
  );
}

function UserCard({ user, onLogout, onChangePin, side, compact }) {
  const [open, setOpenLocal] = React.useState(false);
  return (
    <div style={{ position: "relative", padding: side ? 14 : 0 }}>
      <button onClick={() => setOpenLocal((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, width: side ? "100%" : "auto", padding: side ? "10px 12px" : "8px 10px", borderRadius: 11, border: "none", background: side ? "rgba(255,255,255,.07)" : "transparent", cursor: "pointer", fontFamily: "var(--sans)" }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: user.role === "admin" ? "#f59e0b" : "var(--sidebar-active)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={user.role === "admin" ? "shield" : "user"} size={17} color="#fff" />
        </span>
        {!compact && <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--sidebar-ink)", opacity: .7 }}>{user.role === "admin" ? "หัวหน้า/แอดมิน" : "เภสัชกร"}</span>
        </span>}
        <Icon name="chevron" size={15} color="var(--sidebar-ink)" />
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: side ? "100%" : "auto", top: side ? "auto" : "100%", right: side ? 14 : 0, left: side ? 14 : "auto", marginBottom: side ? 6 : 0, marginTop: side ? 0 : 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "0 12px 30px rgba(0,0,0,.18)", overflow: "hidden", zIndex: 50, minWidth: 200 }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{user.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{user.license}</div>
          </div>
          <button onClick={() => { setOpenLocal(false); onChangePin(); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--ink)", fontSize: 13.5, fontWeight: 500, fontFamily: "var(--sans)" }}>
            <Icon name="shield" size={16} color="var(--brand-deep)" />เปลี่ยน PIN
          </button>
          <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 14px", border: "none", background: "none", cursor: "pointer", color: "#b91c1c", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--sans)" }}>
            <Icon name="logout" size={16} color="#b91c1c" />ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ syncState, dueFollow, user, onOpenPatient }) {
  const [open, setOpen] = React.useState(false);
  const syncColors = { connecting: "#d97706", syncing: "#d97706", synced: "#16a34a", error: "#dc2626" };
  const syncLabels = { connecting: "กำลังเชื่อมต่อ Firebase...", syncing: "กำลังซิงค์...", synced: "ซิงค์ Firebase สำเร็จ", error: "เชื่อมต่อไม่ได้ — ทำงาน offline" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "10px clamp(18px,2.4vw,30px)", borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 25 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-2)", marginRight: "auto" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: syncColors[syncState] || "#16a34a", boxShadow: `0 0 0 4px ${(syncColors[syncState] || "#16a34a")}22`, transition: "all .3s" }} />
        {syncLabels[syncState] || "ซิงค์แล้ว"}
      </div>
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen((o) => !o)} style={{ position: "relative", width: 40, height: 40, borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <Icon name="bell" size={19} color="var(--ink-2)" />
          {dueFollow.length > 0 && <span style={{ position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", fontFamily: "var(--mono)" }}>{dueFollow.length}</span>}
        </button>
        {open && (
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, width: 320, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "0 14px 36px rgba(0,0,0,.16)", zIndex: 60, overflow: "hidden" }}>
            <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>การแจ้งเตือนติดตามผู้ป่วย</div>
            {dueFollow.length ? dueFollow.map((r) => (
              <button key={r.id} onClick={() => { setOpen(false); onOpenPatient(r.hn); }} className="acrow" style={{ display: "flex", gap: 10, width: "100%", padding: "12px 16px", border: "none", borderBottom: "1px solid var(--border)", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
                <span style={{ marginTop: 2 }}><Icon name="clock" size={16} color={r.followUp.due <= "2026-05-29" ? "#dc2626" : "#d97706"} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name} <span style={{ fontFamily: "var(--mono)", fontWeight: 400, color: "var(--ink-2)", fontSize: 11 }}>HN {r.hn}</span></span>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{r.followUp.note}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: r.followUp.due <= "2026-05-29" ? "#dc2626" : "#d97706", fontWeight: 600, marginTop: 2 }}>นัด {fmtDate(r.followUp.due)}{r.followUp.due <= "2026-05-29" && " · ครบกำหนด"}</span>
                </span>
              </button>
            )) : <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--ink-2)", fontSize: 13 }}>ไม่มีนัดติดตามที่ใกล้ถึง</div>}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
