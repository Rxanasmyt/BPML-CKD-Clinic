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

### 0. Babel transform check (STRONGEST — catches ALL syntax errors) ⭐
This uses the EXACT same Babel the app loads in-browser, so if it passes here it
will parse in the browser. Run this FIRST — it would have caught every `size:11`
type bug instantly.
```bash
node -e "
const fs=require('fs'), vm=require('vm');
const s={console}; s.self=s; s.window=s; s.global=s; vm.createContext(s);
vm.runInContext(fs.readFileSync('vendor/babel.min.js','utf8'), s);
const B=s.Babel; let ok=true;
['drug_db','herb_db','drp_engine','data','theme','tweaks-panel','firebase','settings','login','dashboard','patients','form','calendar','reports','app'].forEach(f=>{
  try{B.transform(fs.readFileSync('app/'+f+'.jsx','utf8'),{presets:['react']});console.log('OK    '+f);}
  catch(e){ok=false;console.log('ERROR '+f+' — '+String(e.message).split(String.fromCharCode(10))[0]);}
});
process.exit(ok?0:1);
"
# Every file must print OK. Any ERROR = browser white screen.
```

### 1. JSX attribute syntax — colon instead of equals
```bash
# Finds prop:value bugs like size:11 (should be size={11})
# Only flags lines with a JSX component tag <ComponentName ... prop:number
node -e "
const fs = require('fs');
['app/patients.jsx','app/dashboard.jsx','app/form.jsx','app/login.jsx','app/app.jsx'].forEach(f => {
  fs.readFileSync(f,'utf8').split('\n').forEach((line, i) => {
    if (/<[A-Z][a-zA-Z]+/.test(line) && /\s[a-z][a-zA-Z]+:[0-9]/.test(line))
      console.log('ISSUE ' + f + ':' + (i+1) + ': ' + line.trim());
  });
});
console.log('check 1 done');
"
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
# FSection and MedRow wrapper divs must NOT have overflow:hidden (clips autocomplete dropdowns)
# Safe overflow:hidden: text-overflow ellipsis spans, modal scroll areas, the dropdown list itself
node -e "
const src = require('fs').readFileSync('app/form.jsx','utf8');
const lines = src.split('\n');
const bad = [];
lines.forEach((l,i) => {
  if (!l.includes('overflow') || !l.includes('hidden')) return;
  // Skip: text truncation (has textOverflow), scroll containers (has overflowY), dropdown list itself (has zIndex:9000)
  if (l.includes('textOverflow') || l.includes('overflowY') || l.includes('zIndex')) return;
  // Skip: spans (not block containers)
  if (l.trim().startsWith('<span')) return;
  // Flag: block-level containers with overflow:hidden that wrap inputs
  const ctx = lines.slice(Math.max(0,i-10), i+2).join(' ');
  if (ctx.includes('function F') || ctx.includes('function Med') || ctx.includes('borderRadius: 14') || ctx.includes('borderRadius: 12'))
    bad.push('line ' + (i+1) + ': ' + l.trim().slice(0,80));
});
if (bad.length) console.log('ISSUE — overflow:hidden may clip dropdowns:\n' + bad.join('\n'));
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
