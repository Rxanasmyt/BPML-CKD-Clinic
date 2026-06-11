/* =========================================================================
   login.jsx — หน้าเข้าสู่ระบบ with modern animations
   ========================================================================= */

/* ── Floating particle canvas background ── */
function ParticleCanvas() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const particles = Array.from({ length: 22 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      r: 4 + Math.random() * 18,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: 0.04 + Math.random() * 0.1,
    }));
    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.r) p.x = canvas.width + p.r;
        if (p.x > canvas.width + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = canvas.height + p.r;
        if (p.y > canvas.height + p.r) p.y = -p.r;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [shake, setShake] = React.useState(false);
  const [userFocus, setUserFocus] = React.useState(false);
  const [pinFocus, setPinFocus] = React.useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  async function submit(e) {
    e && e.preventDefault();
    if (!username.trim() || !pin) {
      setErr("กรุณากรอกชื่อผู้ใช้และ PIN");
      setShake(true); setTimeout(() => setShake(false), 600);
      return;
    }
    setLoading(true); setErr("");
    try {
      // เก็บ credentials ชั่วคราวเพื่อ re-authenticate admin หลังสร้างบัญชีใหม่
      window._adminReauthCreds = { email: `${username.trim().toLowerCase()}@pharm-ckd.internal`, pin };
      const u = await FirebaseUserStore.auth(username.trim().toLowerCase(), pin);
      if (!u) {
        delete window._adminReauthCreds;
        setErr("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
        setShake(true); setTimeout(() => setShake(false), 600);
      } else {
        onLogin(u);
      }
    } catch (e) {
      delete window._adminReauthCreds;
      if (e.code === "auth/user-not-found") {
        setErr("บัญชีนี้ยังไม่ได้ migrate — ติดต่อแอดมินให้สร้าง Auth Account ใน Settings");
      } else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setErr("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
      } else if (e.code === "auth/network-request-failed") {
        setErr("เชื่อมต่อ Firebase ไม่ได้ — กรุณาตรวจสอบอินเทอร์เน็ต");
      } else {
        setErr("เกิดข้อผิดพลาด: " + (e.message || e.code));
      }
      setShake(true); setTimeout(() => setShake(false), 600);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", display:"grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
      background:"var(--bg)", fontFamily:"var(--sans)" }}>

      {/* ── Left: brand panel ── */}
      <div style={{ background:"var(--sidebar)", color:"#fff",
        padding: isMobile ? "28px 24px" : "clamp(32px,5vw,72px)",
        display:"flex", flexDirection:"column",
        justifyContent: isMobile ? "flex-start" : "space-between",
        gap: isMobile ? 20 : 0,
        position:"relative", overflow:"hidden",
        minHeight: isMobile ? "auto" : "100vh" }}>

        {/* Animated particle canvas */}
        <ParticleCanvas />

        {/* Dot grid overlay */}
        <div style={{ position:"absolute", inset:0, opacity:.06,
          backgroundImage:"radial-gradient(circle at 80% 15%, #fff 0 1.5px, transparent 1.5px)",
          backgroundSize:"26px 26px", pointerEvents:"none" }} />

        {/* Mesh gradient blobs */}
        <div className="float-anim" style={{ position:"absolute", top:"-10%", left:"30%", width:340, height:340,
          borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,.07) 0%,transparent 70%)",
          pointerEvents:"none" }} />
        <div className="float-anim-2" style={{ position:"absolute", bottom:"-5%", right:"-10%", width:260, height:260,
          borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)",
          pointerEvents:"none" }} />

        {/* Logo */}
        <div style={{ position:"relative", display:"flex", alignItems:"center", gap:13,
          animation:"fadeUp 0.5s ease-out both" }}>
          <div className="risk-brand-pulse" style={{ width:48, height:48, borderRadius:14,
            background:"var(--sidebar-active)", display:"grid", placeItems:"center",
            boxShadow:"0 4px 16px rgba(0,0,0,.25)" }}>
            <Icon name="kidney" size={28} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:19, letterSpacing:.4 }}>PHARM-CKD</div>
            <div style={{ fontSize:10.5, opacity:.6, letterSpacing:2 }}>BPML CLINIC</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position:"relative", animation:"fadeUp 0.6s ease-out 0.1s both" }}>
          <div style={{ fontSize:12.5, letterSpacing:3.5, textTransform:"uppercase", opacity:.55, marginBottom:14,
            display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:20, height:1.5, background:"rgba(255,255,255,.5)", borderRadius:1 }} />
            BPML · CKD Clinic
          </div>
          <h1 style={{ fontSize:"clamp(26px,3.4vw,44px)", lineHeight:1.16, margin:0, fontWeight:800 }}>
            ระบบบันทึกข้อมูลยา<br />ผู้ป่วยโรคไตเรื้อรัง
          </h1>
          <p style={{ fontSize:15.5, lineHeight:1.75, opacity:.8, marginTop:18, maxWidth:440 }}>
            Best Possible Medication List &amp; Medication Reconciliation — บันทึกรวดเร็ว ซิงค์ Firebase อัตโนมัติ จัดลำดับความเสี่ยงเพื่อความปลอดภัยของผู้ป่วย
          </p>

          {/* Feature badge pills */}
          <div style={{ display:"flex", gap:10, marginTop:28, flexWrap:"wrap" }}>
            {[
              { icon:"bell",   label:"ซิงค์ Firebase",    delay:"0s" },
              { icon:"shield", label:"ประเมินความเสี่ยง", delay:"0.12s" },
              { icon:"clock",  label:"ติดตามผู้ป่วย",    delay:"0.24s" },
            ].map(({ icon, label, delay }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:7,
                padding:"8px 14px", borderRadius:99,
                background:"rgba(255,255,255,.12)", backdropFilter:"blur(8px)",
                border:"1px solid rgba(255,255,255,.18)",
                fontSize:12.5, fontWeight:600,
                animation:`float 4s ease-in-out ${delay} infinite, fadeUp 0.5s ease-out ${delay} both`,
                boxShadow:"0 2px 8px rgba(0,0,0,.15)" }}>
                <Icon name={icon} size={14} color="rgba(255,255,255,.9)" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer stats — hidden on mobile */}
        {!isMobile && (
          <div style={{ position:"relative", display:"flex", gap:22, animation:"fadeUp 0.5s ease-out 0.3s both" }}>
            {[["100%", "ทำงานออฟไลน์"], ["AES-256", "เข้ารหัสข้อมูล"], ["Real-time", "Firebase Sync"]].map(([val, lbl]) => (
              <div key={lbl} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:14, fontWeight:800, color:"rgba(255,255,255,.9)" }}>{val}</div>
                <div style={{ fontSize:10.5, opacity:.55, marginTop:2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: login form ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        padding: isMobile ? "24px 20px 40px" : "32px",
        background:"var(--bg)" }}>
        <form onSubmit={submit}
          style={{ width:"100%", maxWidth:380,
            animation:"slideInCard 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>

          <div style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:"var(--ink)", margin:"0 0 6px", lineHeight:1.2 }}>
              เข้าสู่ระบบ
            </h2>
            <p style={{ color:"var(--ink-2)", fontSize:14, margin:0 }}>สำหรับเภสัชกรผู้ดูแลคลินิก CKD</p>
          </div>

          {/* Username input */}
          <label style={lblS}>ชื่อผู้ใช้ (Username)</label>
          <div style={{ position:"relative", marginBottom:16 }}>
            <input value={username}
              onChange={(e) => { setUsername(e.target.value); setErr(""); }}
              onFocus={() => setUserFocus(true)}
              onBlur={() => setUserFocus(false)}
              autoComplete="username" placeholder="Username"
              style={{ ...inpS,
                border: `1.5px solid ${userFocus ? "var(--brand)" : "var(--border)"}`,
                boxShadow: userFocus
                  ? "0 0 0 3px rgba(13,148,136,.18), 0 0 16px rgba(13,148,136,.08)"
                  : "none",
                transition:"border-color 0.2s, box-shadow 0.2s" }} />
            {username && (
              <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)" }}>
                <span style={{ fontSize:14 }}>✓</span>
              </div>
            )}
          </div>

          {/* PIN input */}
          <label style={lblS}>รหัส PIN</label>
          <div style={{ position:"relative", marginBottom:6 }}>
            <input value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g,"")); setErr(""); }}
              onFocus={() => setPinFocus(true)}
              onBlur={() => setPinFocus(false)}
              type={show ? "text" : "password"} inputMode="numeric" maxLength={6} placeholder="••••"
              style={{ ...inpS, letterSpacing:show?0:4, paddingRight:60,
                border:`1.5px solid ${pinFocus ? "var(--brand)" : "var(--border)"}`,
                boxShadow: pinFocus
                  ? "0 0 0 3px rgba(13,148,136,.18), 0 0 16px rgba(13,148,136,.08)"
                  : "none",
                transition:"border-color 0.2s, box-shadow 0.2s" }} />
            <button type="button" onClick={() => setShow((s) => !s)}
              style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                border:"none", background:"none", color:"var(--brand-deep)",
                fontSize:12.5, fontWeight:600, cursor:"pointer", padding:"4px 6px",
                borderRadius:6, fontFamily:"var(--sans)" }}>
              {show ? "ซ่อน" : "แสดง"}
            </button>
          </div>

          {/* Error */}
          {err && (
            <div style={{ marginTop:12, marginBottom:4, color:"#b91c1c", background:"#fef2f2",
              border:"1px solid #fca5a5", padding:"10px 13px", borderRadius:10,
              fontSize:13, display:"flex", gap:8, alignItems:"center",
              animation: shake ? "shake 0.5s ease both" : "fadeUp 0.2s ease both" }}>
              <Icon name="alert" size={15} />{err}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            onClick={(e) => { if (!loading && window.addRipple) window.addRipple(e); }}
            className="btn-primary"
            style={{ marginTop:20, width:"100%", padding:"14px",
              border:"none", borderRadius:13,
              background: loading
                ? "var(--ink-2)"
                : "linear-gradient(135deg,var(--brand),var(--brand-deep))",
              color:"#fff", fontSize:15.5, fontWeight:700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily:"var(--sans)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow: loading ? "none" : "0 4px 18px rgba(13,148,136,.4)",
              transition:"all 0.2s", position:"relative", overflow:"hidden" }}>
            {loading ? <><Spinner />กำลังตรวจสอบ...</> : "เข้าสู่ระบบ"}
          </button>

        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ width:18, height:18, border:"2.5px solid rgba(255,255,255,.35)",
      borderTopColor:"#fff", borderRadius:"50%", display:"inline-block",
      animation:"spin .7s linear infinite" }} />
  );
}

const lblS = { display:"block", fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:7 };
const inpS = { width:"100%", padding:"13px 14px", border:"1.5px solid var(--border)",
  borderRadius:11, fontSize:15, fontFamily:"var(--sans)", color:"var(--ink)",
  background:"var(--surface)", boxSizing:"border-box", outline:"none" };

Object.assign(window, { LoginScreen });
