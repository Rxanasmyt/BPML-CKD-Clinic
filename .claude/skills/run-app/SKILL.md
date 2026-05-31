---
description: Launch and validate the BPML-CKD-Clinic web app before any release
---

# Run & Validate — BPML-CKD-Clinic

## Launch
```bash
cd /home/user/BPML-CKD-Clinic
python3 -m http.server 9199 &>/tmp/bpml_server.log &
sleep 1 && curl -s -o /dev/null -w "%{http_code}" http://localhost:9199/
```
Expected: `200`

## Pre-release checklist (run ALL before every commit)

### 1. JSX attribute syntax — colon instead of equals
```bash
# Finds prop:value bugs like size:11 (should be size={11})
grep -rn '\s[a-zA-Z]\+:[0-9]\+[\s/>]' app/*.jsx \
  | grep -v "style=" | grep -v "\/\/" | grep -v "font-size\|font-weight\|line-height\|border-radius\|z-index\|margin\|padding\|gap\|width\|height\|flex\|color\|background"
# Must produce NO output
```

### 2. Global function availability — fmtDate must be in data.jsx window export
```bash
node -e "
const src = require('fs').readFileSync('app/data.jsx','utf8');
const hasExport = src.includes('fmtDate') && src.includes('Object.assign(window');
console.log('fmtDate exported from data.jsx:', hasExport ? 'OK' : 'MISSING — will crash dashboard');
"
```

### 3. overflow:hidden clipping dropdowns
```bash
# Any FSection or MedRow container must NOT have overflow:hidden
node -e "
const src = require('fs').readFileSync('app/form.jsx','utf8');
const lines = src.split('\n');
const bad = [];
lines.forEach((l,i) => {
  if (l.includes('overflow') && l.includes('hidden')) {
    // Check surrounding lines for dropdown-containing components
    const ctx = lines.slice(Math.max(0,i-5), i+5).join(' ');
    if (ctx.includes('FSection') || ctx.includes('MedRow') || ctx.includes('position.*relative')) {
      bad.push((i+1) + ': ' + l.trim());
    }
  }
});
if (bad.length) console.log('WARNING — overflow:hidden may clip dropdowns:\n' + bad.join('\n'));
else console.log('overflow check: OK');
"
```

### 4. Dropdown z-index — all dropdowns must be >= 9000
```bash
node -e "
const src = require('fs').readFileSync('app/form.jsx','utf8');
const low = src.match(/zIndex:\s*[0-9]+/g) || [];
const bad = low.filter(z => {
  const n = parseInt(z.match(/[0-9]+/)[0]);
  return n < 9000 && n > 30; // ignore low z-index on non-dropdown elements
});
if (bad.length) console.log('Low zIndex found (may be clipped):', bad);
else console.log('zIndex check: OK');
"
```

### 5. Service worker cache name — must be bumped on each release
```bash
grep "CACHE_NAME" sw.js
# Check manually: if files changed since last release, increment version
```

### 6. Firebase loading blocker — app must not wait on Firestore before rendering
```bash
node -e "
const src = require('fs').readFileSync('app/app.jsx','utf8');
const blocked = src.includes('syncState === \"connecting\" && records.length === 0');
console.log('Firebase loading blocker:', blocked ? 'PRESENT — will show spinner forever on slow connections' : 'OK');
"
```

## Release workflow
1. Run ALL checks above — fix any failures before continuing
2. Increment sw.js CACHE_NAME (v1 → v2 → v3...) if ANY file changed
3. `git add` specific files, commit, push
4. `git tag vX.Y.Z && git push origin vX.Y.Z`
5. User creates GitHub release from that tag

## Known past bugs (never repeat these)
| Bug | Root cause | Fix |
|-----|-----------|-----|
| `size:11` SyntaxError | JSX attr used `:` instead of `={...}` | Always check with grep above |
| `fmtDate is not defined` | Defined in patients.jsx but used in dashboard.jsx (loads earlier) | Shared globals go in data.jsx with window export |
| Dropdown not visible (drug/herb) | Parent container had `overflow:hidden` | Check ALL ancestor divs for overflow:hidden when adding dropdowns |
| Spinner forever on login | `records.length === 0` condition blocked render until Firestore responded | Initialize records with `Store.all()`, never block render on Firebase |
| User still sees old bugs after release | Service worker served cached files | Always bump CACHE_NAME in sw.js |
