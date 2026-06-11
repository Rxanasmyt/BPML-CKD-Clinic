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

function AccessDenied() {
  return (
    <div style={{ padding: "60px 24px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>ไม่มีสิทธิ์เข้าถึง</div>
      <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>
        เฉพาะหัวหน้า/แอดมินเท่านั้นที่เข้าถึงหน้านี้ได้<br />
        หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => { applyTheme(t.theme, t.density); }, [t.theme, t.density]);
  React.useEffect(() => { document.documentElement.style.fontSize = (16 * t.fontScale / 100) + "px"; }, [t.fontScale]);

  const { toasts, show: showToast } = useToast();
  React.useEffect(() => { window.showToast = showToast; }, [showToast]);

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
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [moreOpen, setMoreOpen] = React.useState(false);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [dataReady, setDataReady] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = React.useState(
    () => (typeof window.OfflineQueue !== "undefined" ? window.OfflineQueue.getCount() : 0)
  );
  React.useEffect(() => {
    function onOnline()  { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    function onQueueChange(e) { setOfflineQueueCount(e.detail.count); }
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("offline-queue-changed", onQueueChange);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("offline-queue-changed", onQueueChange);
    };
  }, []);

  /* --- Global keyboard shortcuts ---
     "/"           → โฟกัสช่องค้นหา
     "g" then "n"  → ไปหน้าบันทึกใหม่ (chord)
     Esc           → ปิด overlay / blur
     (Ctrl+S ในฟอร์มจัดการเองภายใน BpmlForm) */
  React.useEffect(() => {
    let chordTimer = null, awaitingG = false;
    function inField(el) {
      const tag = (el && el.tagName) || "";
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el && el.isContentEditable);
    }
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const editing = inField(document.activeElement);
      // "/" focus search (เฉพาะตอนไม่ได้พิมพ์ในช่องอื่น)
      if (e.key === "/" && !editing) {
        const el = document.getElementById("global-search-input");
        if (el) { e.preventDefault(); el.focus(); }
        return;
      }
      // chord: g → n  = บันทึกใหม่
      if (!editing && e.key.toLowerCase() === "g") {
        awaitingG = true;
        clearTimeout(chordTimer);
        chordTimer = setTimeout(() => { awaitingG = false; }, 800);
        return;
      }
      if (awaitingG && !editing) {
        awaitingG = false;
        clearTimeout(chordTimer);
        const k = e.key.toLowerCase();
        if (k === "n") { e.preventDefault(); setRoute({ view: "form" }); }
        else if (k === "p") { e.preventDefault(); setRoute({ view: "patients" }); }
        else if (k === "d") { e.preventDefault(); setRoute({ view: "dashboard" }); }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(chordTimer); };
  }, []);

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
        else { setRecords(recs); setSyncState("synced"); setDataReady(true); }
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
  function logout(reason) {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
    if (reason === "idle" && window.showToast) window.showToast("ออกจากระบบอัตโนมัติเพื่อความปลอดภัย (ไม่มีการใช้งาน 20 นาที)", "info", "หมดเวลาเซสชัน");
  }

  /* --- Auto-logout เมื่อไม่มีการใช้งาน 20 นาที (PDPA: กันข้อมูลผู้ป่วยค้างจอ) --- */
  const IDLE_MS = 20 * 60 * 1000;
  React.useEffect(() => {
    if (!user) return;
    let timer = null;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => logout("idle"), IDLE_MS); };
    const events = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [user?.id]);

  // sync ชื่อ/ข้อมูล user ปัจจุบันจาก Firestore อัตโนมัติ
  React.useEffect(() => {
    if (!user) return;
    const unsub = FirebaseUserStore.listen((users) => {
      const updated = users.find((u) => u.id === user.id);
      if (updated && (updated.name !== user.name || updated.pinHash !== user.pinHash || updated.license !== user.license || updated.role !== user.role)) {
        const { pin: _p, ...safe } = updated; // ไม่เก็บ plaintext pin ใน state/localStorage
        updateCurrentUser(safe);
      }
    });
    return () => unsub && unsub();
  }, [user?.id]);

  async function deleteRecord(rec, reason) {
    setSyncState("syncing");
    try {
      const log = {
        id: "del_" + Date.now(),
        type: "delete_visit",
        recordId: rec.id,
        hn: rec.hn,
        patientName: rec.name,
        visitDate: rec.date,
        deletedBy: user.name,
        deletedByUsername: user.username,
        deletedAt: new Date().toISOString(),
        reason: reason || "",
        snapshot: JSON.stringify(rec),
      };
      // FirebaseStore.remove จัดการทั้ง audit log + ลบ record และ non-blocking เมื่อออฟไลน์
      await window.FirebaseStore.remove(rec.id, log);
      haptic([18, 40, 18]);
      showToast(
        navigator.onLine ? `ลบ Visit ${rec.date} ของ ${rec.name} แล้ว` : "ลบแล้ว — จะ sync เมื่อกลับออนไลน์",
        navigator.onLine ? "success" : "warning", navigator.onLine ? "ลบแล้ว" : "รอ sync");
      const remaining = records.filter((r) => r.hn === rec.hn && r.id !== rec.id);
      setRoute(remaining.length ? { view: "patient", hn: rec.hn } : { view: "patients" });
    } catch (e) {
      console.error("deleteRecord error:", e);
      showToast("ลบไม่สำเร็จ: " + e.message, "error", "เกิดข้อผิดพลาด");
    }
    setTimeout(() => setSyncState("synced"), 900);
  }

  async function saveRecord(rec) {
    setSyncState("syncing");
    try {
      const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const saved = await FirebaseStore.save({ ...rec, time });
      haptic(navigator.onLine ? 14 : [14, 30, 14]);
      if (!navigator.onLine) {
        showToast("บันทึกในคิวแล้ว — จะ sync อัตโนมัติเมื่อกลับออนไลน์", "warning", "รอ sync");
      } else {
        showToast("บันทึกข้อมูลผู้ป่วยสำเร็จ", "success", "บันทึกแล้ว ✓");
      }
      setRoute({ view: "patient", hn: saved.hn });
    } catch (e) {
      console.error("saveRecord error:", e);
      showToast("บันทึกไม่สำเร็จ — ไม่สามารถเชื่อมต่อฐานข้อมูล กรุณาลองใหม่", "error", "เกิดข้อผิดพลาด");
      setSyncState("error");
      return;
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

  const scope = records; // ทุก role เห็นข้อมูลผู้ป่วยทั้งหมด (Firestore เป็น single source of truth)
  const dueFollow = scope.filter((r) => r.followUp && r.followUp.due && r.followUp.due <= isoAddDays(7))
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
      onDelete={deleteRecord}
      onNew={(p) => setRoute({ view: "form", editing: {
        hn: p.hn, name: p.name, age: p.age, sex: p.sex, ckdStage: p.ckdStage,
        allergy: p.allergy, dm: p.dm, physician: p.physician,
        // ยกยาเดิม + OTC จาก visit ล่าสุดมาให้ เพื่อทำ reconciliation ไม่ต้องพิมพ์ใหม่ทั้งหมด
        meds: (p.meds || []).map((m) => JSON.parse(JSON.stringify(m))),
        otcItems: (p.otcItems || []).map((o) => JSON.parse(JSON.stringify(o))),
        otcHerbal: p.otcHerbal || false, otcDetail: p.otcDetail || "",
        sources: [], drps: [], interventions: [],
        comparedPrev: false, comparedNew: false, discrepancy: "none",
        date: todayISO(), _carriedFromVisit: p.date || true, id: undefined,
      } })} />;
  else if (route.view === "settings")
    page = user.role === "admin"
      ? <SettingsPage currentUser={user} onUserUpdated={updateCurrentUser} />
      : <AccessDenied />;
  else if (route.view === "deletelog")
    page = user.role === "admin" ? <DeleteLogPage /> : <AccessDenied />;
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
      { v: "deletelog", icon: "clock", label: "ประวัติลบ" },
    ] : []),
  ];

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
        {!isMobile && <TopBar syncState={syncState} dueFollow={dueFollow} user={user} onOpenPatient={(hn) => setRoute({ view: "patient", hn })} records={records} onNavigate={setRoute} currentTheme={t.theme} onToggleDark={() => setTweak("theme", t.theme === "dark" ? "teal" : "dark")} />}
        {/* Offline / Queue banner */}
        {(!isOnline || offlineQueueCount > 0) && (
          <div style={{ background: !isOnline ? "#78350f" : "#1e3a5f", color: "#fff", padding: "9px 18px",
            display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600,
            borderBottom: "1px solid rgba(255,255,255,.12)" }}>
            <span style={{ fontSize: 16 }}>{!isOnline ? "📵" : "🔄"}</span>
            <span>
              {!isOnline
                ? `ออฟไลน์อยู่ — ข้อมูลถูกเก็บในเครื่องและ sync อัตโนมัติเมื่อกลับออนไลน์${offlineQueueCount > 0 ? ` (ค้าง ${offlineQueueCount} รายการ)` : ""}`
                : `กำลัง sync ${offlineQueueCount} รายการที่ค้างไว้...`}
            </span>
          </div>
        )}
        {!dataReady && syncState === "connecting" ? (
          <div style={{ padding: "clamp(16px,2.2vw,28px)", maxWidth: 1380, margin: "0 auto" }}>
            <div style={{ display:"flex", gap:16, marginBottom:20 }}>
              {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ flex:1, height:120, borderRadius:16 }} />)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1.2fr", gap:16, marginBottom:16 }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height:200, borderRadius:18 }} />)}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton-line" style={{ width:`${85-i*10}%`, height:18 }} />)}
            </div>
          </div>
        ) : (
          <div key={route.view+(route.hn||'')} className="page-enter">
            <PageErrorBoundary resetKey={route.view+(route.hn||'')}>{page}</PageErrorBoundary>
          </div>
        )}
      </main>

      {/* Mobile: bottom navigation (max 4 primary + More sheet) */}
      {isMobile && (() => {
        const primary = nav.slice(0, 4);
        const overflow = nav.slice(4);
        const overflowActive = overflow.some((n) => route.view === n.v);
        const cells = overflow.length
          ? [...primary, { v: "__more", icon: "menu", label: "เพิ่มเติม", _more: true }]
          : primary;
        return (
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "stretch", height: 62, boxShadow: "0 -4px 20px rgba(0,0,0,.1)" }}>
            {cells.map((n) => {
              const active = n._more ? overflowActive : (route.view === n.v || (n.v === "patients" && route.view === "patient"));
              return (
                <button key={n.v} className="bottom-nav-btn" onClick={() => n._more ? setMoreOpen(true) : setRoute({ view: n.v })} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--sans)", padding: "6px 2px", transition: "all 0.15s", color: active ? "var(--brand)" : "var(--ink-2)" }}>
                  <div style={{ width: active ? 36 : 28, height: 28, borderRadius: active ? 10 : 8, background: active ? "var(--brand-soft)" : "transparent", display: "grid", placeItems: "center", transition: "all 0.15s" }}>
                    <Icon name={n.icon} size={19} color={active ? "var(--brand)" : "var(--ink-2)"} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{n.label}</span>
                </button>
              );
            })}
          </nav>
        );
      })()}

      {/* Mobile: "More" bottom sheet */}
      {isMobile && moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", animation: "fadeIn 0.2s ease-out both" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "10px 16px calc(16px + env(safe-area-inset-bottom))", animation: "fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--border)", margin: "6px auto 14px" }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", margin: "0 6px 10px" }}>เมนูเพิ่มเติม</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {nav.slice(4).map((n) => {
                const active = route.view === n.v;
                return (
                  <button key={n.v} onClick={() => { setRoute({ view: n.v }); setMoreOpen(false); }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", borderRadius: 14, cursor: "pointer", fontFamily: "var(--sans)",
                      border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                      background: active ? "var(--brand-soft)" : "var(--surface-2)" }}>
                    <Icon name={n.icon} size={22} color={active ? "var(--brand)" : "var(--ink)"} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--brand-deep)" : "var(--ink)" }}>{n.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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

function TopBar({ syncState, dueFollow, user, onOpenPatient, records = [], onNavigate, currentTheme, onToggleDark }) {
  const [open, setOpen] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState("");
  const [searchFocus, setSearchFocus] = React.useState(false);
  const syncColors = { connecting: "#d97706", syncing: "#d97706", synced: "#16a34a", error: "#dc2626" };
  const syncLabels = { connecting: "กำลังเชื่อมต่อ Firebase...", syncing: "กำลังซิงค์...", synced: "ซิงค์ Firebase สำเร็จ", error: "เชื่อมต่อไม่ได้ — ทำงาน offline" };

  // Global search results
  const searchResults = React.useMemo(() => {
    if (!searchQ.trim() || searchQ.trim().length < 2) return [];
    const q = searchQ.trim().toLowerCase();
    const seen = new Set();
    const results = [];
    records.forEach((r) => {
      if ((r.name||"").toLowerCase().includes(q) || (r.hn||"").toLowerCase().includes(q)) {
        if (!seen.has(r.hn)) { seen.add(r.hn); results.push(r); }
      }
    });
    return results.slice(0, 6);
  }, [searchQ, records]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "10px clamp(18px,2.4vw,30px)", borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 25 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-2)", marginRight: "auto" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: syncColors[syncState] || "#16a34a", boxShadow: `0 0 0 4px ${(syncColors[syncState] || "#16a34a")}22`, transition: "all .3s" }} />
        {syncLabels[syncState] || "ซิงค์แล้ว"}
      </div>

      {/* Global Search */}
      <div style={{ position: "relative", flex: "0 1 280px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1.5px solid ${searchFocus ? "var(--brand)" : "var(--border)"}`, borderRadius: 11, background: "var(--surface-2)", transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: searchFocus ? "0 0 0 3px color-mix(in srgb,var(--brand) 16%,transparent)" : "none" }}>
          <Icon name="search" size={15} color="var(--ink-2)" />
          <input id="global-search-input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => { setSearchFocus(false); setSearchQ(""); }, 200)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchQ(""); e.currentTarget.blur(); } }}
            placeholder="ค้นหาผู้ป่วย (ชื่อ/HN)… กด /"
            style={{ border: "none", background: "none", outline: "none", fontSize: 13, color: "var(--ink)", fontFamily: "var(--sans)", width: "100%", minWidth: 0 }} />
          {searchQ && <button onClick={() => setSearchQ("")} style={{ border:"none", background:"none", cursor:"pointer", padding:0, flexShrink:0, display:"grid", placeItems:"center" }}><Icon name="x" size={13} color="var(--ink-2)" /></button>}
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "0 12px 32px rgba(0,0,0,.16)", zIndex: 80, overflow: "hidden", animation: "fadeUp 0.18s ease-out both" }}>
            {searchResults.map((r) => {
              const risk = computeRisk(r);
              const rColors = { high:"#dc2626", medium:"#d97706", low:"#16a34a" };
              return (
                <button key={r.hn} onMouseDown={() => { onNavigate && onNavigate({ view:"patient", hn:r.hn }); setSearchQ(""); }} className="acrow"
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"11px 14px", border:"none", borderBottom:"1px solid var(--border)", background:"none", cursor:"pointer", textAlign:"left", fontFamily:"var(--sans)" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:rColors[risk.band], flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                    <div style={{ fontSize:11.5, color:"var(--ink-2)", fontFamily:"var(--mono)" }}>HN {r.hn} · CKD {r.ckdStage}</div>
                  </div>
                  <Icon name="chevronR" size={14} color="var(--ink-2)" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <button onClick={onToggleDark} title={currentTheme === "dark" ? "สว่าง" : "มืด"}
        style={{ width:38, height:38, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)", display:"grid", placeItems:"center", cursor:"pointer", transition:"all 0.2s", flexShrink:0 }}>
        <span style={{ fontSize:17 }}>{currentTheme === "dark" ? "☀️" : "🌙"}</span>
      </button>
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
                <span style={{ marginTop: 2 }}><Icon name="clock" size={16} color={r.followUp.due <= todayISO() ? "#dc2626" : "#d97706"} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name} <span style={{ fontFamily: "var(--mono)", fontWeight: 400, color: "var(--ink-2)", fontSize: 11 }}>HN {r.hn}</span></span>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{r.followUp.note}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: r.followUp.due <= todayISO() ? "#dc2626" : "#d97706", fontWeight: 600, marginTop: 2 }}>นัด {fmtDate(r.followUp.due)}{r.followUp.due <= todayISO() && " · ครบกำหนด"}</span>
                </span>
              </button>
            )) : <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--ink-2)", fontSize: 13 }}>ไม่มีนัดติดตามที่ใกล้ถึง</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Per-page Error Boundary: ถ้าหน้าใดพัง nav/sidebar ยังอยู่ กดไปหน้าอื่นต่อได้ ---
   reset อัตโนมัติเมื่อ resetKey เปลี่ยน (เปลี่ยน route แล้ว error เคลียร์เอง) */
class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Page crashed:", error, info); }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "clamp(24px,5vw,60px)", maxWidth: 560, margin: "0 auto", textAlign: "center", fontFamily: "var(--sans)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😵</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>หน้านี้แสดงผลไม่สำเร็จ</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>ข้อมูลของคุณยังปลอดภัย — ลองกดไปหน้าอื่นหรือโหลดหน้านี้ใหม่</div>
          <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", margin: "14px auto", maxWidth: 480, wordBreak: "break-word", fontFamily: "var(--mono)" }}>
            {String(this.state.error && this.state.error.message || this.state.error)}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => this.setState({ error: null })}
              style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ลองอีกครั้ง
            </button>
            <button onClick={() => window.location.reload()}
              style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              โหลดใหม่
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* --- Error Boundary: กัน white screen เวลา render error --- */
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("App crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center",
          fontFamily: "var(--sans)", background: "#f1f6f5", color: "#334" }}>
          <div style={{ fontSize: 38 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>เกิดข้อผิดพลาดในการแสดงผล</div>
          <div style={{ fontSize: 13, color: "#dc2626", maxWidth: 480, wordBreak: "break-word" }}>
            {String(this.state.error && this.state.error.message || this.state.error)}
          </div>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 8, padding: "10px 22px", borderRadius: 10, border: "none",
              background: "#0d9488", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// เคลียร์ boot-loader เมื่อ React mount สำเร็จ
const _bootLoader = document.getElementById("boot-loader");
if (_bootLoader) _bootLoader.remove();

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppErrorBoundary><App /></AppErrorBoundary>
);
