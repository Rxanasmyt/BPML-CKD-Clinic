/* =========================================================================
   firebase.jsx — Firebase App + Auth + Firestore
   Auth: Firebase Authentication (email/password)  ← migrated from PIN-only
   Data: Firestore with offline persistence + realtime sync
   ========================================================================= */

/* ---- Offline write-queue counter ---- */
let _pendingCount = 0;
function _setPending(n) {
  if (n !== _pendingCount) {
    _pendingCount = n;
    window.dispatchEvent(new CustomEvent("offline-queue-changed", { detail: { count: n } }));
  }
}
window.OfflineQueue = { getCount: () => _pendingCount };

/* ---- PIN hash helpers (ยังคงเก็บ PIN hash ไว้ใน Firestore user doc
   เพื่อแสดงตัวตน "เภสัชกรคนไหน" บนเครื่อง — Auth ทำ access control จริง) ---- */
async function _prepUserForSave(u) {
  const out = { ...u };
  if (typeof out.pin === "string" && out.pin.length > 0) {
    out.pinSalt = window.randomSalt();
    out.pinHash = await window.hashPin(out.pin, out.pinSalt);
  }
  delete out.pin;
  return out;
}

/* ---- Firebase config ---- */
const FB_CONFIG = {
  apiKey:            "AIzaSyA03p5JNF-uw8QTdAS8m7zD4HLbhUFpMvI",
  authDomain:        "pharm-ckd-clinic.firebaseapp.com",
  projectId:         "pharm-ckd-clinic",
  storageBucket:     "pharm-ckd-clinic.firebasestorage.app",
  messagingSenderId: "20076284742",
  appId:             "1:20076284742:web:450388a00a2988942c7347",
};

/* ---- Initialize Firebase (SDKs pre-loaded in index.html) ---- */
let _app, _auth, _db;
try { _app = firebase.app(); } catch (e) { _app = firebase.initializeApp(FB_CONFIG); }
_auth = firebase.auth();
_db   = firebase.firestore();

_db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code !== "failed-precondition" && err.code !== "unimplemented")
    console.warn("Persistence:", err.code);
});

// ทำให้ App ส่วนอื่นเข้าถึง db ได้ตามเดิม
window.db = _db;

const COLL_REC = "pharm_ckd_records";
const COLL_USR = "pharm_ckd_users";

/* =========================================================================
   FirebaseStore — Firestore records (ใช้ request.auth จาก Firebase Auth)
   ========================================================================= */
const FirebaseStore = {
  listen(callback) {
    return _db.collection(COLL_REC).onSnapshot(
      { includeMetadataChanges: true },
      (snap) => {
        const recs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        recs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        _setPending(snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
        callback(recs, null);
      },
      (err) => {
        console.error("Firestore:", err);
        callback([], err);
      }
    );
  },
  async save(rec) {
    const now = new Date().toISOString();
    if (!rec.id) rec.id = "r" + Date.now();
    if (!rec.createdAt) rec.createdAt = now;
    rec.updatedAt = now;
    const p = _db.collection(COLL_REC).doc(rec.id).set(rec);
    if (navigator.onLine) await p; else p.catch(() => {});
    return rec;
  },
  async remove(id, log) {
    const logP = log ? _db.collection("pharm_ckd_delete_log").doc(log.id).set(log) : null;
    const delP = _db.collection(COLL_REC).doc(id).delete();
    if (navigator.onLine) { if (logP) await logP.catch(() => {}); await delP; }
    else { if (logP) logP.catch(() => {}); delP.catch(() => {}); }
  },
  async reset() {
    const snap = await _db.collection(COLL_REC).get();
    const batch = _db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },
  async seed() {},
};

/* =========================================================================
   FirebaseUserStore — ผสาน Firebase Auth + Firestore user doc
   • auth()   → signInWithEmailAndPassword (Firebase Auth ทำ access control)
   • save()   → สร้าง/อัปเดต Auth account + Firestore doc พร้อมกัน
   • remove() → ลบ Auth account + Firestore doc พร้อมกัน
   ========================================================================= */

// แปลง username → email ภายใน (ผู้ใช้ไม่เห็น)
function _toEmail(username) {
  return `${username.trim().toLowerCase()}@pharm-ckd.internal`;
}

const FirebaseUserStore = {
  listen(callback) {
    return _db.collection(COLL_USR).onSnapshot(
      (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => callback([])
    );
  },

  // login: Firebase Auth sign-in → ดึง Firestore user doc
  // throws Firebase Auth errors so caller can show specific messages
  async auth(username, pin) {
    const email = _toEmail(username);
    // let Auth errors propagate — caller handles error codes
    await _auth.signInWithEmailAndPassword(email, pin);
    // Auth สำเร็จ → ดึง profile จาก Firestore
    try {
      const snap = await _db.collection(COLL_USR)
        .where("username", "==", username.trim().toLowerCase()).limit(1).get();
      if (snap.empty) { await _auth.signOut(); return null; }
      const u = { ...snap.docs[0].data(), id: snap.docs[0].id };
      const { pin: _p, pinHash: _h, pinSalt: _s, ...safe } = u;
      return safe;
    } catch (e) {
      await _auth.signOut().catch(() => {});
      return null;
    }
  },

  // สร้าง/แก้ไข user: สร้าง Firebase Auth account + เขียน Firestore doc
  async save(u) {
    if (!u.id) u.id = "u" + Date.now();
    u.updatedAt = new Date().toISOString();
    const email = _toEmail(u.username || u.id);

    // ถ้ามี pin ใหม่ → สร้าง/อัปเดต Firebase Auth account
    if (typeof u.pin === "string" && u.pin.length >= 4) {
      const currentUser = _auth.currentUser;
      try {
        // ลองสร้าง account ใหม่ก่อน
        await _auth.createUserWithEmailAndPassword(email, u.pin);
        // sign back in as original user (admin)
        if (currentUser && currentUser.email !== email) {
          // admin stays signed in; new account is separate
          // just sign out new account immediately — they'll sign in themselves
          await _auth.signOut();
          // re-authenticate admin: ดึง admin credentials จาก session storage ชั่วคราว
          const adminCreds = window._adminReauthCreds;
          if (adminCreds) {
            await _auth.signInWithEmailAndPassword(adminCreds.email, adminCreds.pin)
              .catch(() => {});
            delete window._adminReauthCreds;
          }
        }
      } catch (e) {
        if (e.code === "auth/email-already-in-use") {
          // อัปเดต password ของ account เดิม ผ่าน Admin SDK ไม่ได้จาก client
          // เก็บ flag ให้ admin รู้ว่า PIN เปลี่ยนแล้ว (จะ sync เมื่อ user login ครั้งต่อไปผ่าน updatePassword)
          u._pinPendingSync = true;
        } else {
          throw e;
        }
      }
    }

    const prepared = await _prepUserForSave(u);
    prepared._email = email; // เก็บ email ใน doc เพื่อใช้อ้างอิงภายหลัง
    await _db.collection(COLL_USR).doc(prepared.id).set(prepared, { merge: true });
    return prepared;
  },

  async remove(id) {
    // ลบ Firestore doc ก่อน
    await _db.collection(COLL_USR).doc(id).delete();
    // Auth account ลบไม่ได้จาก client โดยตรง (ต้องใช้ Admin SDK / Console)
    // บันทึก flag ให้ admin ทราบ
    console.warn(`Firebase Auth account for user ${id} must be deleted manually in Firebase Console > Authentication`);
  },

  async seed() {},
};

/* ---- Export to window ---- */
window.FirebaseStore    = FirebaseStore;
window.FirebaseUserStore = FirebaseUserStore;

/* ---- Auth state change → แจ้ง App เมื่อ Firebase session เปลี่ยน ---- */
_auth.onAuthStateChanged((firebaseUser) => {
  window.dispatchEvent(new CustomEvent("firebase-auth-state", { detail: { firebaseUser } }));
});

/* ---- กลับมาออนไลน์: Firestore sync อัตโนมัติ ---- */
window.addEventListener("online", () => {
  if (_pendingCount > 0 && window.showToast)
    window.showToast(`กำลัง sync ${_pendingCount} รายการที่ค้างไว้...`, "info", "กลับมาออนไลน์");
});

// ลบ localStorage cache เก่า
localStorage.removeItem("pharm_ckd_records_v1");
localStorage.removeItem("pharm_ckd_migrated_v1");

console.log("✅ Firebase Auth + Firestore initialized");
window.dispatchEvent(new CustomEvent("firebase-ready"));
