---
description: Deploy and release a new version of BPML-CKD-Clinic after code changes
---

# Deploy & Release Skill

After completing any code change task for BPML-CKD-Clinic, follow these steps automatically.

## 0. Rules — ห้ามละเมิด

- **ห้ามลบ/แก้ข้อมูลใน Firestore** โดยไม่ได้รับคำสั่งชัดเจน
- **ห้ามใส่ข้อมูลตัวอย่าง (seed/demo data)** ในโค้ดหรือ database
- **ห้ามแตะ credentials/ชื่อ/รหัสผู้ใช้** — ให้ admin จัดการเองผ่านแอพ
- **ห้ามแก้สิ่งที่ทำงานได้ดีอยู่แล้ว** เมื่อเพิ่ม feature ใหม่

## 1. Set git identity + bump SW cache

```bash
git config user.email noreply@anthropic.com
git config user.name Claude
```

ใน `sw.js` increment `CACHE_NAME` (e.g. `pharm-ckd-v23` → `pharm-ckd-v24`) ทุกครั้งก่อน commit

## 2. Commit

```bash
git add <changed files>
git commit -m "<descriptive message in English>

https://claude.ai/code/session_01CbZFbENhnfGYQX5CT3TaTG"
```

## 3. Push to GitHub (triggers auto-deploy)

```bash
GIT_ASKPASS=/bin/true git -c credential.helper='' push https://<PAT>@github.com/Rxanasmyt/BPML-CKD-Clinic.git claude/lucid-mccarthy-VoB5Q
```

PAT: ask user if not in session context  
GitHub Actions deploys to https://pharm-ckd-clinic.web.app within ~2 minutes.

## 4. Create GitHub Release

Increment version:
- **Patch** (v1.3.0 → v1.3.1): bug fixes, minor tweaks
- **Minor** (v1.3.x → v1.4.0): new feature, new UI section
- **Major** (v1.x → v2.0.0): full redesign (rare)

```bash
git tag vX.Y.Z
GIT_ASKPASS=/bin/true git -c credential.helper='' push https://<PAT>@github.com/Rxanasmyt/BPML-CKD-Clinic.git vX.Y.Z

curl -s -X POST \
  -H "Authorization: token <PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/Rxanasmyt/BPML-CKD-Clinic/releases \
  -d "{
    \"tag_name\": \"vX.Y.Z\",
    \"target_commitish\": \"claude/lucid-mccarthy-VoB5Q\",
    \"name\": \"BPML-CKD-CLINIC vX.Y.Z\",
    \"body\": \"<Thai-language changelog>\",
    \"draft\": false,
    \"prerelease\": false
  }"
```

Release body เขียนภาษาไทย สรุปสิ่งที่เปลี่ยนแปลง

## 5. Current app state (อัปเดต 2026-06-06)

**Stack:** React 18 UMD + Babel standalone, Firebase Firestore, Firebase Hosting PWA  
**Branch:** `claude/lucid-mccarthy-VoB5Q`  
**Live:** https://pharm-ckd-clinic.web.app  
**SW cache:** v23  

**Features ที่มีแล้ว (ห้ามแตะถ้าไม่ได้รับคำสั่ง):**
- Firebase Firestore เป็น single source of truth (ไม่มี localStorage fallback สำหรับ records)
- Admin-only: จัดการบัญชี, ประวัติลบ
- Delete Visit พร้อม confirmation modal + audit log (`pharm_ckd_delete_log`)
- Mobile: bottom nav 4 tabs + "เพิ่มเติม" bottom sheet
- Dashboard: onboarding empty state, KPI cards, charts
- Form: autosave draft, duplicate visit warning, HN auto-fill, copy meds from prev visit
- Global search ใน TopBar (desktop)
- Dark mode toggle ใน TopBar
- Skeleton loading ระหว่าง Firebase connect
- Page slide transitions
- Card hover lift animation
- Error boundary with reload button
