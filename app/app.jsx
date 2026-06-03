/* =========================================================================
   app.jsx — โครงแอป: Firebase listener, routing, sidebar, Tweaks
   ========================================================================= */

// Toast types: success | error | warning | info
function ToastContainer({ toasts }) {
  return (
    <>
      <style>{`@keyframes toastIn { from{opacity:0;transform:translateY(16px) scale(0.94)} to{opacity:1;transform:translateY(0) scale(1)} }`}</style>
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column-reverse", gap:10, pointerEvents:"none" }}>
        {toasts.map(t => <Toast key={t.id} toast={t} />)}
      </div>
    </>
  );
}

function Toast({ toast }) {
  const [visible, setVisible] = React.useState(true);
  // fade out before removal
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(false), toast.duration - 300);
    return () => clearTimeout(t);
  }, []);

  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const colors = {
    success: { bg:"#f0fdf4", border:"#bbf7d0", text:"#166534", icon:"#16a34a" },
    error:   { bg:"#fef2f2", border:"#fecaca", text:"#991b1b", icon:"#dc2626" },
    warning: { bg:"#fffbeb", border:"#fde68a", text:"#92400e", icon:"#d97706" },
    info:    { bg:"var(--surface)", border:"var(--border)", text:"var(--ink)", icon:"var(--brand)" },
  };
  const c = colors[toast.type] || colors.info;

  return (
    <div style={{
      pointerEvents:"auto",
      display:"flex", alignItems:"flex-start", gap:12,
      padding:"13px 16px", borderRadius:14,
      background: c.bg, border:`1px solid ${c.border}`,
      boxShadow:"0 8px 30px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.08)",
      minWidth:280, maxWidth:380,
      fontFamily:"var(--sans)", fontSize:14,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.96)",
      transition: "opacity 0.28s ease, transform 0.28s ease",
      animation: "toastIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
    }}>
      <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>{icons[toast.type]}</span>
      <div style={{ flex:1 }}>
        {toast.title && <div style={{ fontWeight:700, color:c.text, marginBottom:2 }}>{toast.title}</div>}
        <div style={{ color:c.text, opacity:0.85, fontSize:13.5, lineHeight:1.4 }}>{toast.message}</div>
      </div>
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const show = React.useCallback((message, type="info", title="", duration=3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type, title, duration }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);
  return { toasts, show };
}

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

  const { toasts, show: showToast } = useToast();
  React.useEffect(() => { window.showToast = showToast; }, [showToast]);

  const [user, setUser] = React.useState(() => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; } });
  const [records, setRecords] = React.useState(() => Store.all());
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

  // sync ชื่อ/ข้อมูล user ปัจจุบันจาก Firestore อัตโนมัติ
  React.useEffect(() => {
    if (!user) return;
    const unsub = FirebaseUserStore.listen((users) => {
      const updated = users.find((u) => u.id === user.id);
      if (updated && (updated.name !== user.name || updated.pin !== user.pin || updated.license !== user.license || updated.role !== user.role)) {
        updateCurrentUser(updated);
      }
    });
    return () => unsub && unsub();
  }, [user?.id]);

  async function saveRecord(rec) {
    setSyncState("syncing");
    try {
      const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const saved = await FirebaseStore.save({ ...rec, time });
      showToast("บันทึกข้อมูลผู้ป่วยสำเร็จ", "success", "บันทึกแล้ว ✓");
      setRoute({ view: "patient", hn: saved.hn });
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "error", "เกิดข้อผิดพลาด");
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
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sideMode = !isMobile && t.navStyle === "sidebar";

  return (
    <div style={{ minHeight: "100vh", display: sideMode ? "flex" : "block", background: "var(--bg)", fontFamily: "var(--sans)", color: "var(--ink)" }}>
      <style>{`
        @media print { .sidebar, header, .no-print { display: none !important; } body, .app-main { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .bottom-nav-btn:active { opacity: 0.7; transform: scale(0.92); }
      `}</style>
      {changePinOpen && <ChangePinModal user={user} onClose={() => setChangePinOpen(false)} onUpdated={updateCurrentUser} />}

      {/* Desktop: sidebar or topbar */}
      {!isMobile && (sideMode ? (
        <aside className="sidebar" style={{ width: 232, background: 'linear-gradient(175deg, var(--sidebar) 0%, color-mix(in srgb,var(--sidebar) 80%,#000) 100%)', color: "var(--sidebar-ink)", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
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
      ))}

      {/* Mobile: top mini-header */}
      {isMobile && (
        <div style={{ background: "var(--sidebar)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52, position: "sticky", top: 0, zIndex: 30, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--sidebar-active)", display: "grid", placeItems: "center" }}>
              <Icon name="kidney" size={18} color="#fff" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.1 }}>PHARM-CKD</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,.75)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: syncState === "synced" ? "#4ade80" : "#fbbf24", flexShrink: 0 }} />
              {syncState === "synced" ? "ซิงค์แล้ว" : "กำลังซิงค์"}
            </div>
            {dueFollow.length > 0 && (
              <div style={{ background: "#dc2626", color: "#fff", borderRadius: 99, minWidth: 20, height: 20, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, padding: "0 5px" }}>{dueFollow.length}</div>
            )}
            <UserCard user={user} onLogout={logout} onChangePin={() => setChangePinOpen(true)} compact />
          </div>
        </div>
      )}

      <main style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 64 : 0 }}>
        {!isMobile && <TopBar syncState={syncState} dueFollow={dueFollow} user={user} onOpenPatient={(hn) => setRoute({ view: "patient", hn })} />}
        <div key={route.view+(route.hn||'')} className="page-enter">{page}</div>
      </main>

      {/* Mobile: bottom navigation */}
      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "stretch", height: 62, boxShadow: "0 -4px 20px rgba(0,0,0,.1)" }}>
          {nav.map((n) => {
            const active = route.view === n.v || (n.v === "patients" && route.view === "patient");
            return (
              <button key={n.v} className="bottom-nav-btn" onClick={() => setRoute({ view: n.v })} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--sans)", padding: "6px 2px", transition: "all 0.15s", color: active ? "var(--brand)" : "var(--ink-2)" }}>
                <div style={{ width: active ? 36 : 28, height: 28, borderRadius: active ? 10 : 8, background: active ? "var(--brand-soft)" : "transparent", display: "grid", placeItems: "center", transition: "all 0.15s" }}>
                  <Icon name={n.icon} size={19} color={active ? "var(--brand)" : "var(--ink-2)"} />
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{n.label}</span>
              </button>
            );
          })}
        </nav>
      )}
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
      <ToastContainer toasts={toasts} />
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
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position:"relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <button onClick={onClick} style={{
        display:"flex", alignItems:"center", gap:11,
        padding: side ? "11px 14px" : "9px 14px",
        border:"none", cursor:"pointer", fontFamily:"var(--sans)", fontSize:14,
        fontWeight: active ? 700 : 500,
        width: side ? "100%" : "auto", textAlign:"left",
        borderLeft: active ? '3px solid rgba(255,255,255,0.9)' : '3px solid transparent',
        paddingLeft:11,
        background: active
          ? 'rgba(255,255,255,0.15)'
          : hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        transition:'all 0.18s ease',
        borderRadius: active ? '0 10px 10px 0' : 10,
        color: active ? "#fff" : "var(--sidebar-ink)",
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.1), inset 3px 0 8px rgba(255,255,255,0.15)' : 'none',
      }}>
        <Icon name={n.icon} size={19} color={active ? "#fff" : "currentColor"} />
        {n.label}
      </button>
      {/* Tooltip - shows on hover, positioned to the right */}
      {hovered && side && (
        <div style={{
          position:"absolute", left:"calc(100% + 10px)", top:"50%",
          transform:"translateY(-50%)",
          background:"var(--ink)", color:"#fff",
          padding:"5px 10px", borderRadius:8,
          fontSize:12, fontWeight:600, whiteSpace:"nowrap",
          boxShadow:"0 4px 14px rgba(0,0,0,.25)",
          pointerEvents:"none", zIndex:100,
          animation:"fadeIn 0.15s ease both",
        }}>
          {n.label}
          <div style={{ position:"absolute", right:"100%", top:"50%", transform:"translateY(-50%)",
            width:0, height:0, borderTop:"5px solid transparent", borderBottom:"5px solid transparent",
            borderRight:"6px solid var(--ink)" }} />
        </div>
      )}
    </div>
  );
}

function getInitials(name) {
  return name.replace(/^(ภ[ญก]\.|นพ\.|พ[ญก]\.|ดร\.)\s*/,'').trim()
    .split(/\s+/).slice(0,2).map(w=>w[0]||'').join('');
}
function avatarColor(name) {
  const palette=['#0d9488','#7c3aed','#0284c7','#d97706','#dc2626','#16a34a','#db2777'];
  const h = [...name].reduce((a,c)=>a+c.charCodeAt(0),0);
  return palette[h%palette.length];
}

function UserCard({ user, onLogout, onChangePin, side, compact }) {
  const [open, setOpenLocal] = React.useState(false);
  return (
    <div style={{ position: "relative", padding: side ? 14 : 0 }}>
      <button onClick={() => setOpenLocal((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, width: side ? "100%" : "auto", padding: side ? "10px 12px" : "8px 10px", borderRadius: 11, border: "none", background: side ? "rgba(255,255,255,.07)" : "transparent", cursor: "pointer", fontFamily: "var(--sans)" }}>
        <span style={{
          width:32, height:32, borderRadius:9,
          background: user.role==='admin' ? '#f59e0b' : avatarColor(user.name),
          display:'grid', placeItems:'center', flexShrink:0,
          fontSize:12, fontWeight:800, color:'#fff', letterSpacing:-0.5, userSelect:'none',
        }}>
          {getInitials(user.name)}
        </span>
        {!compact && <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--sidebar-ink)", opacity: .7 }}>{user.role === "admin" ? "หัวหน้า/แอดมิน" : "เภสัชกร"}</span>
        </span>}
        <Icon name="chevron" size={15} color="var(--sidebar-ink)" />
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: side ? "100%" : "auto", top: side ? "auto" : "100%", right: side ? 14 : 0, left: side ? 14 : "auto", marginBottom: side ? 6 : 0, marginTop: side ? 0 : 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "0 12px 30px rgba(0,0,0,.18)", overflow: "hidden", zIndex: 50, minWidth: 200 }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width:32, height:32, borderRadius:9,
              background: user.role==='admin' ? '#f59e0b' : avatarColor(user.name),
              display:'grid', placeItems:'center', flexShrink:0,
              fontSize:12, fontWeight:800, color:'#fff', letterSpacing:-0.5, userSelect:'none',
            }}>
              {getInitials(user.name)}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{user.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{user.license}</div>
            </div>
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
