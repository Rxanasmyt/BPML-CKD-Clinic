/* =========================================================================
   login.jsx — หน้าเข้าสู่ระบบ (auth ผ่าน Firestore)
   ========================================================================= */
function LoginScreen({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function submit(e) {
    e && e.preventDefault();
    if (!username.trim() || !pin) { setErr("กรุณากรอกชื่อผู้ใช้และ PIN"); return; }
    setLoading(true); setErr("");
    try {
      const u = await FirebaseUserStore.auth(username.trim().toLowerCase(), pin);
      if (!u) { setErr("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง"); }
      else { onLogin(u); }
    } catch (err) {
      setErr("เชื่อมต่อ Firebase ไม่ได้ — กรุณาตรวจสอบอินเทอร์เน็ต");
    }
    setLoading(false);
  }

  function quick(u) { setUsername(u.username); setPin(u.pin); setErr(""); }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr", background: "var(--bg)", fontFamily: "var(--sans)" }}>
      {/* ซ้าย: brand panel */}
      <div style={{ background: "var(--sidebar)", color: "#fff", padding: "clamp(32px,5vw,72px)", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: .07, backgroundImage: "radial-gradient(circle at 80% 15%, #fff 0 1.5px, transparent 1.5px)", backgroundSize: "26px 26px" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--sidebar-active)", display: "grid", placeItems: "center" }}>
            <Icon name="kidney" size={26} color="#fff" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: .3 }}>PHARM-CKD</div>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", opacity: .6, marginBottom: 14 }}>BPML · CKD Clinic</div>
          <h1 style={{ fontSize: "clamp(26px,3.4vw,42px)", lineHeight: 1.18, margin: 0, fontWeight: 700 }}>
            ระบบบันทึกข้อมูลยา<br />ผู้ป่วยโรคไตเรื้อรัง
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, opacity: .8, marginTop: 18, maxWidth: 420 }}>
            Best Possible Medication List &amp; Medication Reconciliation — บันทึกรวดเร็ว ซิงค์ Firebase อัตโนมัติ จัดลำดับความเสี่ยงเพื่อความปลอดภัยของผู้ป่วย
          </p>
          <div style={{ display: "flex", gap: 22, marginTop: 30 }}>
            {[["ซิงค์ Firebase", "bell"], ["ประเมินความเสี่ยง", "shield"], ["ติดตามผู้ป่วย", "clock"]].map(([t, ic]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .85 }}>
                <Icon name={ic} size={16} color="var(--sidebar-active)" />{t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", fontSize: 12.5, opacity: .55, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="shield" size={14} /> ข้อมูลเข้ารหัส · บันทึกผู้เข้าใช้งานทุกครั้ง
        </div>
      </div>

      {/* ขวา: ฟอร์ม */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>เข้าสู่ระบบ</h2>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "0 0 26px" }}>สำหรับเภสัชกรผู้ดูแลคลินิก CKD</p>

          <label style={lblS}>ชื่อผู้ใช้ (Username)</label>
          <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); }}
            autoComplete="username" placeholder="เช่น pharm1" style={inpS} />

          <label style={{ ...lblS, marginTop: 16 }}>รหัส PIN</label>
          <div style={{ position: "relative" }}>
            <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
              type={show ? "text" : "password"} inputMode="numeric" maxLength={6} placeholder="••••"
              style={{ ...inpS, letterSpacing: show ? 0 : 4, paddingRight: 56 }} />
            <button type="button" onClick={() => setShow((s) => !s)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "var(--brand-deep)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {show ? "ซ่อน" : "แสดง"}
            </button>
          </div>

          {err && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "9px 12px", borderRadius: 9, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><Icon name="alert" size={15} />{err}</div>}

          <button type="submit" disabled={loading} style={{ marginTop: 22, width: "100%", padding: "13px", border: "none", borderRadius: 11, background: loading ? "var(--ink-2)" : "var(--brand)", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {loading ? <><Spinner />กำลังตรวจสอบ...</> : "เข้าสู่ระบบ"}
          </button>

          <div style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10, fontWeight: 600 }}>บัญชีทดลอง (กดเพื่อกรอกอัตโนมัติ)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {USERS.map((u) => (
                <button key={u.id} type="button" onClick={() => quick(u)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: u.role === "admin" ? "#fef3c7" : "var(--brand-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name={u.role === "admin" ? "shield" : "user"} size={16} color={u.role === "admin" ? "#b45309" : "var(--brand-deep)"} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{u.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{u.username} · PIN {u.pin} · {u.role === "admin" ? "หัวหน้า/แอดมิน" : "เภสัชกร"}</span>
                  </span>
                  <Icon name="chevronR" size={15} color="var(--ink-2)" />
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

const lblS = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 7 };
const inpS = { width: "100%", padding: "12px 13px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 15, fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)", boxSizing: "border-box", outline: "none" };

Object.assign(window, { LoginScreen });
