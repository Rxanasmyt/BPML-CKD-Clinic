/* =========================================================================
   firebase.jsx — โหลด Firebase SDK แบบ dynamic + fallback localStorage
   ========================================================================= */

function _buildLocalStores() {
  // Simple localStorage user store (used before Firebase loads)
  const LS_USERS = "pharm_ckd_users_v1";
  function getLocalUsers() { try { const u = JSON.parse(localStorage.getItem(LS_USERS) || "null"); return u && u.length ? u : []; } catch (e) { return []; } }
  function saveLocalUsers(list) { localStorage.setItem(LS_USERS, JSON.stringify(list)); }

  const LocalStore = {
    listen(cb) { cb(Store.all(), null); return () => {}; },
    async save(rec) { return Store.save(rec); },
    async remove(id) { Store.remove(id); },
    async reset() { Store.reset(); },
    async seed() {},
  };
  const LocalUserStore = {
    listen(cb) { cb(getLocalUsers()); return () => {}; },
    async auth(un, pin) {
      const list = getLocalUsers();
      const u = list.find((x) => x.username === un.trim().toLowerCase());
      return u && u.pin === pin ? u : null;
    },
    async save(u) {
      const list = getLocalUsers();
      const i = list.findIndex((x) => x.id === u.id);
      if (i >= 0) list[i] = u; else list.push(u);
      saveLocalUsers(list); return u;
    },
    async remove(id) { saveLocalUsers(getLocalUsers().filter((x) => x.id !== id)); },
    async seed() {},
  };
  return { LocalStore, LocalUserStore };
}

// ---- Export stubs immediately (localStorage mode until Firebase loads) ----
const { LocalStore, LocalUserStore } = _buildLocalStores();
let FirebaseStore = LocalStore;
let FirebaseUserStore = LocalUserStore;
Object.assign(window, { FirebaseStore, FirebaseUserStore });

// ---- Dynamically load Firebase SDK with 5s timeout ----
function _loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

(async function _initFirebase() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000));
  try {
    await Promise.race([
      (async () => {
        await _loadScript("vendor/firebase-app-compat.js");
        await _loadScript("vendor/firebase-firestore-compat.js");
      })(),
      timeout,
    ]);
  } catch (e) {
    console.log("Firebase SDK load failed/timed out — using localStorage mode:", e.message);
    return; // ใช้ LocalStore ต่อ
  }

  // Firebase loaded ✓ — initialize
  const FB_CONFIG = {
    apiKey: "AIzaSyA03p5JNF-uw8QTdAS8m7zD4HLbhUFpMvI",
    authDomain: "pharm-ckd-clinic.firebaseapp.com",
    projectId: "pharm-ckd-clinic",
    storageBucket: "pharm-ckd-clinic.firebasestorage.app",
    messagingSenderId: "20076284742",
    appId: "1:20076284742:web:450388a00a2988942c7347",
  };

  let _app;
  try { _app = firebase.app(); } catch (e) { _app = firebase.initializeApp(FB_CONFIG); }
  const db = firebase.firestore();

  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code !== "failed-precondition" && err.code !== "unimplemented")
      console.warn("Persistence:", err.code);
  });

  const COLL_REC = "pharm_ckd_records";
  const COLL_USR = "pharm_ckd_users";

  // ---- อัปเดต FirebaseStore เป็น Firestore จริง ----
  const RealStore = {
    listen(callback) {
      return db.collection(COLL_REC).onSnapshot(
        (snap) => {
          const recs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          recs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          callback(recs, null);
        },
        (err) => { console.error("Firestore:", err); callback(Store.all(), err); }
      );
    },
    async save(rec) {
      const now = new Date().toISOString();
      if (!rec.id) rec.id = "r" + Date.now();
      if (!rec.createdAt) rec.createdAt = now;
      rec.updatedAt = now;
      await db.collection(COLL_REC).doc(rec.id).set(rec);
      return rec;
    },
    async remove(id) { await db.collection(COLL_REC).doc(id).delete(); },
    async reset() {
      const snap = await db.collection(COLL_REC).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await RealStore.seed(true);
    },
    async seed(force = false) {
      const snap = await db.collection(COLL_REC).limit(1).get();
      if (!force && !snap.empty) return;
      const batch = db.batch();
      SEED_RECORDS.forEach((r) => batch.set(db.collection(COLL_REC).doc(r.id), { ...r }));
      await batch.commit();
    },
  };

  const RealUserStore = {
    listen(callback) {
      return db.collection(COLL_USR).onSnapshot(
        (snap) => {
          const users = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          callback(users);
        },
        () => callback([])
      );
    },
    async auth(username, pin) {
      try {
        const snap = await db.collection(COLL_USR)
          .where("username", "==", username.trim().toLowerCase()).limit(1).get();
        if (!snap.empty) {
          const u = { ...snap.docs[0].data(), id: snap.docs[0].id };
          return u.pin === pin ? u : null;
        }
      } catch (e) { /* fall through */ }
      return null;
    },
    async save(u) {
      if (!u.id) u.id = "u" + Date.now();
      u.updatedAt = new Date().toISOString();
      await db.collection(COLL_USR).doc(u.id).set(u);
      return u;
    },
    async remove(id) { await db.collection(COLL_USR).doc(id).delete(); },
    async seed() {
      // ไม่ seed demo users อัตโนมัติ — admin สร้างบัญชีเองผ่านหน้า "จัดการบัญชี"
    },
  };

  // อัปเดต window — App จะใช้ stores ใหม่นี้
  window.FirebaseStore = FirebaseStore = RealStore;
  window.FirebaseUserStore = FirebaseUserStore = RealUserStore;
  window.db = db;
  console.log("✅ Firebase Firestore connected");

  // แจ้ง App ให้ restart listener (ถ้า App ยังแสดงข้อมูล localStorage อยู่)
  window.dispatchEvent(new CustomEvent("firebase-ready"));
})();
