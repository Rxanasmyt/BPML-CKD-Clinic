---
description: Deploy and release a new version of BPML-CKD-Clinic after code changes
---

# Deploy & Release Skill

After completing any code change task for BPML-CKD-Clinic, follow these steps automatically.

## 1. Commit changes

```bash
git add <changed files>
git commit -m "<descriptive message in English>"
```

## 2. Bump service worker cache version

In `sw.js`, increment `CACHE_NAME` (e.g. `pharm-ckd-v9` → `pharm-ckd-v10`) so users get the latest files after deploy. Include this in the commit.

## 3. Push to GitHub (triggers auto-deploy)

Use the GitHub PAT stored in the session (ask the user if not available in context):

```bash
git remote set-url origin https://<PAT>@github.com/Rxanasmyt/BPML-CKD-Clinic.git
git push -u origin claude/lucid-mccarthy-VoB5Q
git remote set-url origin https://github.com/Rxanasmyt/BPML-CKD-Clinic.git
```

GitHub Actions will automatically deploy to https://pharm-ckd-clinic.web.app within ~2 minutes.

## 4. Create GitHub Release

Determine the next version by incrementing from the latest release tag:
- **Patch** (v1.3.0 → v1.3.1): bug fixes, minor tweaks
- **Minor** (v1.3.x → v1.4.0): new feature, new DRP rule, new UI section
- **Major** (v1.x → v2.0.0): full redesign (rare)

```bash
git tag vX.Y.Z
git remote set-url origin https://<PAT>@github.com/Rxanasmyt/BPML-CKD-Clinic.git
git push origin vX.Y.Z
git remote set-url origin https://github.com/Rxanasmyt/BPML-CKD-Clinic.git

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

Write the release body in Thai with `##` sections summarizing what changed.
