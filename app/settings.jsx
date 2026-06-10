/* =========================================================================
   settings.jsx — จัดการบัญชีผู้ใช้ (Firestore realtime) + เปลี่ยน PIN
   ========================================================================= */

/* ---------- Modal กรอบ ---------- */
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.38)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="modal-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "26px 28px", width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Icon name="x" size={20} color="var(--ink-2)" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- UserForm สร้าง/แก้ไขบัญชี ---------- */
function UserForm({ initial, currentUser, onDone, onCancel }) {
  const isNew = !initial;
  const [name, setName] = React.useState(initial?.name || "");
  const [username, setUsername] = React.useState(initial?.username || "");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [license, setLicense] = React.useState(initial?.license || "");
  const [role, setRole] = React.useState(initial?.role || "pharmacist");
  const [err, setErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!name.trim()) { setErr("กรุณากรอกชื่อ"); return; }
    if (!username.trim()) { setErr("กรุณากรอกชื่อผู้ใช้"); return; }
    if (!/^[a-z0-9_]+$/.test(username.trim())) { setErr("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, _"); return; }
    if (isNew && pin.length < 4) { setErr("PIN ต้องมีอย่างน้อย 4 หลัก"); return; }
    if (pin && pin.length < 4) { setErr("PIN ต้องมีอย่างน้อย 4 หลัก"); return; }
    if (pin !== pin2) { setErr("PIN ทั้งสองช่องไม่ตรงกัน"); return; }
    setSaving(true);
    try {
      const u = { ...(initial || {}), name: name.trim(), username: username.trim().toLowerCase(), license: license.trim(), role };
      if (pin) u.pin = pin; // ตั้ง/เปลี่ยน PIN เฉพาะเมื่อกรอก (เว้นว่าง = ใช้ PIN เดิม)
      await FirebaseUserStore.save(u);
      onDone(u);
    } catch (e) {
      setErr("บันทึกไม่สำเร็จ: " + e.message);
    }
    setSaving(false);
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <MLabel>ชื่อ-นามสกุล พร้อมคำนำหน้า</MLabel>
          <input style={mInS} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="ภก./ภญ. ชื่อ นามสกุล" />
        </div>
        <div>
          <MLabel>ชื่อผู้ใช้ (Username)</MLabel>
          <input style={{ ...mInS, background: !isNew ? "var(--surface-2)" : undefined }} value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); }} placeholder="เฉพาะ a-z, 0-9" disabled={!isNew} />
          {!isNew && <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4 }}>ไม่สามารถเปลี่ยนชื่อผู้ใช้ได้</div>}
        </div>
        <div>
          <MLabel>เลขใบประกอบวิชาชีพ</MLabel>
          <input style={mInS} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="ภ.xxxxx" />
        </div>
        <div>
          <MLabel>สิทธิ์การใช้งาน</MLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {[["pharmacist", "เภสัชกร"], ["admin", "หัวหน้า / แอดมิน"]].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setRole(v)}
                style={{ flex: 1, padding: "10px", borderRadius: 9, border: `1px solid ${role === v ? "var(--brand)" : "var(--border)"}`, background: role === v ? "var(--brand-soft)" : "var(--surface)", color: role === v ? "var(--brand-deep)" : "var(--ink-2)", fontWeight: role === v ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--sans)" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <MLabel>{isNew ? "PIN (4–6 หลัก)" : "PIN ใหม่ (เว้นว่าง = เดิม)"}</MLabel>
            <input style={mInS} type="password" inputMode="numeric" maxLength={6} value={pin} placeholder={isNew ? "" : "••••"} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} />
          </div>
          <div>
            <MLabel>ยืนยัน PIN</MLabel>
            <input style={mInS} type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => { setPin2(e.target.value.replace(/\D/g, "")); setErr(""); }} />
          </div>
        </div>
        {err && <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "9px 12px", borderRadius: 9, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><Icon name="alert" size={14} />{err}</div>}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onCancel} style={{ flex: 1, ...mGhostBtn }} disabled={saving}>ยกเลิก</button>
        <button onClick={submit} disabled={saving} style={{ flex: 2, ...mPrimaryBtn, opacity: saving ? .7 : 1 }}>
          <Icon name="check" size={16} color="#fff" />{saving ? "กำลังบันทึก..." : isNew ? "สร้างบัญชี" : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </>
  );
}

/* ---------- ChangePinModal เปลี่ยน PIN ตัวเอง ---------- */
function ChangePinModal({ user, onClose, onUpdated }) {
  const [oldPin, setOldPin] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [err, setErr] = React.useState("");
  const [ok, setOk] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (pin.length < 4) { setErr("PIN ใหม่ต้องมีอย่างน้อย 4 หลัก"); return; }
    if (pin !== pin2) { setErr("PIN ใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
    setSaving(true);
    try {
      // ตรวจ PIN เดิมผ่าน auth (รองรับทั้ง hash และ legacy plaintext)
      const verified = await FirebaseUserStore.auth(user.username, oldPin);
      if (!verified) { setErr("PIN เดิมไม่ถูกต้อง"); setSaving(false); return; }
      const updated = await FirebaseUserStore.save({ ...user, pin });
      setOk(true);
      setTimeout(() => { onUpdated(updated); onClose(); }, 1200);
    } catch (e) {
      setErr("บันทึกไม่สำเร็จ: " + e.message);
    }
    setSaving(false);
  }

  return (
    <Modal title="เปลี่ยน PIN ของฉัน" onClose={onClose}>
      {ok ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#16a34a" }}>
          <Icon name="check" size={36} color="#16a34a" /><br />
          <strong style={{ fontSize: 16, display: "block", marginTop: 10 }}>เปลี่ยน PIN สำเร็จ!</strong>
          <span style={{ fontSize: 13, color: "var(--ink-2)" }}>บันทึกลง Firebase แล้ว</span>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><MLabel>PIN เดิม</MLabel><input style={mInS} type="password" inputMode="numeric" maxLength={6} value={oldPin} onChange={(e) => { setOldPin(e.target.value.replace(/\D/g, "")); setErr(""); }} /></div>
            <div><MLabel>PIN ใหม่ (4–6 หลัก)</MLabel><input style={mInS} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} /></div>
            <div><MLabel>ยืนยัน PIN ใหม่</MLabel><input style={mInS} type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => { setPin2(e.target.value.replace(/\D/g, "")); setErr(""); }} /></div>
            {err && <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "9px 12px", borderRadius: 9, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><Icon name="alert" size={14} />{err}</div>}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button onClick={onClose} style={{ flex: 1, ...mGhostBtn }} disabled={saving}>ยกเลิก</button>
            <button onClick={submit} disabled={saving} style={{ flex: 2, ...mPrimaryBtn, opacity: saving ? .7 : 1 }}>
              <Icon name="shield" size={16} color="#fff" />{saving ? "กำลังบันทึก..." : "เปลี่ยน PIN"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- AiSettingsSection — จัดการ Claude API Key ---------- */
function AiSettingsSection() {
  const [key, setKey] = React.useState(() => localStorage.getItem("pharm_ckd_claude_key") || "");
  const [input, setInput] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  function saveKey() {
    const k = input.trim();
    if (!k) return;
    localStorage.setItem("pharm_ckd_claude_key", k);
    setKey(k);
    setInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function removeKey() {
    localStorage.removeItem("pharm_ckd_claude_key");
    setKey("");
    setInput("");
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2, background: "#0d9488" }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>การตั้งค่า AI</h2>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>Claude API Key (Anthropic)</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>ใช้สำหรับฟีเจอร์ "สรุป BPML สำหรับแพทย์ (AI)" ใน PatientDetail</div>
          </div>
        </div>

        {key ? (
          <div style={{ marginBottom: 14, padding: "11px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: "#16a34a", flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: 13, color: "#15803d" }}>
              {key.slice(0, 18)}{"•".repeat(Math.min(20, key.length - 18))}
            </span>
            <button onClick={removeKey} style={{ fontSize: 12, color: "#b91c1c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "var(--sans)" }}>ลบ Key</button>
          </div>
        ) : (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, fontSize: 12.5, color: "#92400e" }}>
            ยังไม่มี API Key — ฟีเจอร์ AI จะไม่สามารถใช้งานได้จนกว่าจะใส่ key
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={key ? "ใส่ Key ใหม่เพื่อเปลี่ยน..." : "sk-ant-api03-..."}
            style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, fontFamily: "monospace", background: "var(--surface)", color: "var(--ink)", outline: "none", boxSizing: "border-box" }}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
          />
          <button onClick={saveKey} disabled={!input.trim()} style={{ padding: "10px 18px", background: input.trim() ? "#0d9488" : "var(--surface-2)", color: input.trim() ? "#fff" : "var(--ink-2)", border: input.trim() ? "none" : "1px solid var(--border)", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: input.trim() ? "pointer" : "not-allowed", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>
            {saved ? "✓ บันทึกแล้ว" : "บันทึก Key"}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-2)" }}>
          Key จะเก็บเฉพาะใน localStorage ของเครื่องนี้เท่านั้น ไม่ได้ส่งไปยังเซิร์ฟเวอร์ใดๆ ของแอป
        </div>
      </div>
    </div>
  );
}

/* ---------- SettingsPage (realtime Firestore users) ---------- */
function SettingsPage({ currentUser, onUserUpdated }) {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null);

  React.useEffect(() => {
    // realtime listener
    const unsub = FirebaseUserStore.listen((u) => { setUsers(u); setLoading(false); });
    return unsub;
  }, []);

  // เฉพาะแอดมินเท่านั้นที่จัดการบัญชีได้
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div style={{ padding: "60px 24px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>ไม่มีสิทธิ์เข้าถึง</div>
        <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 8 }}>เฉพาะหัวหน้า/แอดมินเท่านั้นที่จัดการบัญชีได้</div>
      </div>
    );
  }

  async function handleDelete(u) {
    try { await FirebaseUserStore.remove(u.id); } catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
    setModal(null);
  }

  return (
    <div style={{ padding: "clamp(18px,2.4vw,30px)", maxWidth: 860, margin: "0 auto" }}>
      <PageHead title="จัดการบัญชีผู้ใช้" sub="เพิ่ม แก้ไข หรือลบบัญชีเภสัชกร — ซิงค์ Firebase อัตโนมัติ"
        action={<button onClick={() => setModal({ type: "add" })} style={primaryBtn}><Icon name="plus" size={18} color="#fff" />เพิ่มบัญชีใหม่</button>} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--ink-2)" }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 14px" }} />
          กำลังโหลดจาก Firebase...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <div key={u.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: u.role === "admin" ? "#fef3c7" : "var(--brand-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={u.role === "admin" ? "shield" : "user"} size={22} color={u.role === "admin" ? "#b45309" : "var(--brand-deep)"} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{u.name}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginTop: 3, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>@{u.username}</span>
                  {u.license && <span>· {u.license}</span>}
                  <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: u.role === "admin" ? "#fef3c7" : "var(--brand-soft)", color: u.role === "admin" ? "#b45309" : "var(--brand-deep)" }}>{u.role === "admin" ? "หัวหน้า/แอดมิน" : "เภสัชกร"}</span>
                  {u.id === currentUser.id && <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: "#f0fdf4", color: "#16a34a" }}>บัญชีของฉัน</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModal({ type: "edit", u })} style={mGhostBtn}><Icon name="edit" size={15} />แก้ไข</button>
                {u.id !== currentUser.id && (
                  <button onClick={() => setModal({ type: "delete", u })} style={{ ...mGhostBtn, color: "#b91c1c", borderColor: "#fca5a5" }}><Icon name="x" size={15} />ลบ</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, color: "var(--ink-2)", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon name="shield" size={16} color="var(--ink-2)" />
        <div><strong style={{ color: "var(--ink)" }}>Firebase Firestore:</strong> บัญชีผู้ใช้ทั้งหมดซิงค์ real-time ข้ามอุปกรณ์ — การเปลี่ยน PIN หรือเพิ่มบัญชีใหม่มีผลทันทีทุกเครื่อง</div>
      </div>

      {/* AI Settings section */}
      <AiSettingsSection />


      {modal?.type === "add" && (
        <Modal title="เพิ่มบัญชีใหม่" onClose={() => setModal(null)}>
          <UserForm isNew currentUser={currentUser} onDone={() => setModal(null)} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "edit" && (
        <Modal title="แก้ไขบัญชี" onClose={() => setModal(null)}>
          <UserForm initial={modal.u} currentUser={currentUser}
            onDone={(u) => { if (modal.u.id === currentUser.id) onUserUpdated(u); setModal(null); }}
            onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "delete" && (
        <Modal title="ยืนยันการลบบัญชี" onClose={() => setModal(null)}>
          <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#fef2f2", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
              <Icon name="alert" size={28} color="#dc2626" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{modal.u.name}</div>
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>ต้องการลบบัญชีนี้ใช่หรือไม่?<br />การกระทำนี้ไม่สามารถยกเลิกได้</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setModal(null)} style={{ flex: 1, ...mGhostBtn }}>ยกเลิก</button>
            <button onClick={() => handleDelete(modal.u)} style={{ flex: 1, ...mPrimaryBtn, background: "#dc2626" }}>ลบบัญชี</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MLabel = ({ children }) => <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{children}</label>;
const mInS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)", boxSizing: "border-box", outline: "none" };
const mGhostBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" };
const mPrimaryBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" };

Object.assign(window, { SettingsPage, ChangePinModal, Modal, AiSettingsSection });
