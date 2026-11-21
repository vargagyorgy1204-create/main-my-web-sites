// Laptop review board: `node tests/board-laptop.mjs` -> board/laptop/index.html (+ img/*.jpg, results.json)
//   rows = sections of index.html (Hero, Hero + mini OS panel, Rólam, Készségek, Értékek, Együttműködés, Szolgáltatások, Portfólió heading, every case card,
//          the Instagram card, one open case-study dialog, Kapcsolat, Footer) + the three other pages (full page); columns = the desktop viewports.
//   Every screenshot gets an automatic check list (horizontal overflow, elements outside the viewport, overlapping text boxes, text < 12px, console errors / failed
//   requests); problems are marked in red next to the thumbnail. Does not change any site code. Env: PW_MODULE / PW_CHROMIUM as in tests/smoke.mjs.
//   Options: --viewports=1440x900,1518x670  --only=hero,pf-1   (partial runs merge into results.json)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
{
  const tries = [];
  if (process.env.PW_MODULE) tries.push(() => require(process.env.PW_MODULE));
  tries.push(() => require('playwright'), () => require('playwright-core'));
  tries.push(() => require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
  for (const t of tries) { try { ({ chromium } = t()); break; } catch { /* next */ } }
  if (!chromium) { console.error('Playwright not found (set PW_MODULE=/path/to/playwright).'); process.exit(2); }
}

const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const OUT = path.join(ROOT, 'board', 'laptop'), IMG = path.join(OUT, 'img');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || p.startsWith('/board') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ARG = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).split(',').filter(Boolean);
const ALL_VPS = ['1280x720', '1366x768', '1440x900', '1518x670', '1536x864', '1920x1080', '2560x1440'];
const VPS = (ARG('viewports').length ? ARG('viewports') : ALL_VPS).map(s => { const [w, h] = s.split('x').map(Number); return { w, h, key: s }; });

// [id, label, kind]; kind: index = a viewport of index.html, page = the full page of another page
const CELLS = [
  ['hero', 'Hero', 'index'], ['hero-os', 'Hero · mini OS dock + panel open', 'index'],
  ['about-1', 'Rólam · start', 'index'], ['about-4', 'Rólam · end', 'index'], ['skills', 'Készségek', 'index'],
  ['why-1', 'Értékek · step 1', 'index'], ['why-6', 'Értékek · step 6', 'index'], ['steps', 'Együttműködés', 'index'], ['services', 'Szolgáltatások', 'index'],
  ['pf-head', 'Portfólió · heading', 'index'], ['pf-1', 'Portfólió · card 1', 'index'], ['pf-2', 'Portfólió · card 2', 'index'], ['pf-3', 'Portfólió · card 3', 'index'],
  ['pf-4', 'Portfólió · card 4', 'index'], ['pf-5', 'Portfólió · card 5', 'index'], ['pf-6', 'Portfólió · card 6', 'index'], ['pf-ig', 'Portfólió · Instagram card', 'index'],
  ['pf-dialog', 'Portfólió · case-study dialog open', 'index'], ['contact', 'Kapcsolat', 'index'], ['contact-form', 'Kapcsolat · form', 'index'], ['footer', 'Footer', 'index'],
  ['p-approach', 'myapproach.html (full page)', 'page', 'myapproach.html'], ['p-whatsapp', 'whatsappcontact.html (full page)', 'page', 'whatsappcontact.html'], ['p-privacy', 'adatvedelem.html (full page)', 'page', 'adatvedelem.html'],
].filter(c => !ARG('only').length || ARG('only').includes(c[0]));

const launchOpts = { headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launchOpts);
fs.mkdirSync(IMG, { recursive: true });
const RES_FILE = path.join(OUT, 'results.json');
let results = {};
try { results = JSON.parse(fs.readFileSync(RES_FILE, 'utf8')); } catch { /* first run */ }

const scrollTo = (p, y) => p.evaluate(yy => { if (window.VB && VB.lenis) VB.lenis.scrollTo(yy, { immediate: true }); else scrollTo(0, yy); }, y);
const frames = (p, n = 4) => p.evaluate(k => new Promise(r => { const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const topOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : 0; }, sel);

/* ---- the automatic checks, run inside the page on the CURRENT viewport state (painted elements only: elementFromPoint at the centre of each box) ---- */
const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, out = { hscroll: Math.max(0, document.documentElement.scrollWidth - vw), outside: [], overlaps: [], small: [] };
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.'); return s; };
  const txt = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const skip = e => e.closest('[aria-hidden="true"], .hero-vh, .sr-only, [inert], script, style, noscript, .cookie-banner, .cursor-ring, .cursor-dot');
  const clipped = (e, r) => { for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const ar = a.getBoundingClientRect(); if (r.right <= ar.left || r.left >= ar.right || r.bottom <= ar.top || r.top >= ar.bottom) return true; } } return false; };
  const painted = (e, r) => { const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t) || t.contains(e)); };
  const cand = [];
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const own = txt(e), media = /^(IMG|VIDEO|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName);
    if (!own && !media) continue;
    let r;
    if (own) { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter(q => q.width > 1 && q.height > 1); if (!rs.length) continue; r = { left: Math.min(...rs.map(q => q.left)), top: Math.min(...rs.map(q => q.top)), right: Math.max(...rs.map(q => q.right)), bottom: Math.max(...rs.map(q => q.bottom)) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
    else { const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue; r = { left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.width, height: q.height }; }
    if (r.bottom <= 0 || r.top >= vh) continue;
    if (skip(e) || clipped(e, r) || !painted(e, r)) continue;
    cand.push({ e, r, own, cs });
  }
  for (const c of cand) {
    if (c.r.right > vw + 1 || c.r.left < -1) out.outside.push(`${sel(c.e)} ${Math.round(c.r.left)}..${Math.round(c.r.right)} (vw ${vw})`);
    if (c.own && parseFloat(c.cs.fontSize) < 12 - 0.01) out.small.push(`${sel(c.e)} ${parseFloat(c.cs.fontSize).toFixed(1)}px "${c.own.slice(0, 24)}"`);
  }
  const T = cand.filter(c => c.own);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) { const ar = Math.min(a.r.width * a.r.height, b.r.width * b.r.height); if (w * h > 40 && w * h > 0.25 * ar) out.overlaps.push(`${sel(a.e)} "${a.own.slice(0, 18)}" × ${sel(b.e)} "${b.own.slice(0, 18)}" ${Math.round(w)}×${Math.round(h)}px`); }
  }
  const uniq = a => [...new Set(a)];
  out.outside = uniq(out.outside).slice(0, 8); out.small = uniq(out.small).slice(0, 12); out.overlaps = uniq(out.overlaps).slice(0, 8);
  return out;
};
const merge = (a, b) => { for (const k of ['outside', 'overlaps', 'small']) a[k] = [...new Set([...(a[k] || []), ...b[k]])]; a.hscroll = Math.max(a.hscroll || 0, b.hscroll); return a; };

async function shoot(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const p = await ctx.newPage();
  let errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.|unpkg|googleapis|gstatic|favicon|ERR_(INTERNET|NAME|CONNECTION|BLOCKED|NETWORK)/.test(m.text())) errs.push(m.text().slice(0, 140)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 140)));
  p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });
  const save = async (id, checks, fullPage) => {
    const f = `${id}_${vp.key}.jpg`;
    await p.screenshot({ path: path.join(IMG, f), type: 'jpeg', quality: 72, fullPage: !!fullPage });
    results[f] = { id, vp: vp.key, checks, errors: [...new Set(errs)] }; errs = [];
  };
  const prep = async url => {
    await p.goto(`${BASE}/${url}`, { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignore */ } const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; return document.fonts.ready; });
    await p.waitForFunction(() => !window.VB || !VB.hasST || window.ScrollTrigger.getAll().length > 0, null, { timeout: 5000 }).catch(() => {});
    await frames(p, 6); await sleep(1200);
  };
  const settle = async () => { await frames(p, 8); await sleep(1500); };
  const want = id => CELLS.some(c => c[0] === id);

  /* ---------- index.html ---------- */
  if (CELLS.some(c => c[2] === 'index')) {
    await prep('index.html');
    {                                                              /* warm-up: walk the page once top -> bottom so every once-only reveal has played, like a real visit */
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += Math.round(vp.h * 0.6)) { await scrollTo(p, y); await frames(p, 3); await sleep(110); }
      await scrollTo(p, H); await sleep(900); await scrollTo(p, 0); await sleep(900);
    }
    const pfTops = async () => p.evaluate(() => [...document.querySelectorAll('#pf-deck .pf-case')].map(e => e.getBoundingClientRect().top + scrollY));
    for (const [id] of CELLS.filter(c => c[2] === 'index')) {
      const [sec, step] = id.split('-');
      if (id === 'hero' || id === 'hero-os') await scrollTo(p, 0);
      else if (sec === 'about') {
        const top = await topOf(p, '#about'), sh = await p.evaluate(() => document.getElementById('about').offsetHeight);
        await scrollTo(p, top + (sh - vp.h) * (step === '1' ? 0.2 : 0.85));
      } else if (sec === 'why') {
        const top = await topOf(p, '#why'), pinned = await p.evaluate(() => document.getElementById('why').classList.contains('is-pinned')), k = step === '1' ? 0 : 5;
        if (pinned) await scrollTo(p, top + (k ? 3.3 : 0) * vp.h); else { await scrollTo(p, top); if (k) await p.evaluate(() => { const e = document.querySelectorAll('.hs__card')[5]; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); }); await sleep(1600); }
      } else if (id === 'steps') {
        const pinned = await p.evaluate(() => { const s = document.getElementById('steps'); return getComputedStyle(s.querySelector('.steps-pin') || s).position === 'sticky'; });
        await scrollTo(p, (await topOf(p, '#steps')) + (pinned ? 40 : 0));
      } else if (id === 'footer') await scrollTo(p, await topOf(p, 'footer'));
      else if (id === 'contact-form') await scrollTo(p, (await topOf(p, '.contact-grid')) - Math.round(vp.h * 0.12));
      else if (id === 'pf-head') await scrollTo(p, await topOf(p, '#portfolio'));
      else if (sec === 'pf' && /^\d$/.test(step)) await scrollTo(p, (await pfTops())[+step - 1]);
      else if (id === 'pf-ig') await scrollTo(p, (await pfTops())[6]);
      else if (id === 'pf-dialog') {
        await scrollTo(p, (await pfTops())[0]); await settle();
        await p.evaluate(() => document.querySelector('#pf-deck .pf-case__btn').click()); await sleep(2200);
      } else await scrollTo(p, await topOf(p, '#' + id));
      await settle();
      if (id === 'hero-os') {
        const win = await p.evaluate(() => { const r = document.querySelector('.hw__win').getBoundingClientRect(); return [r.left + r.width * 0.7, r.top + r.height * 0.2]; });
        await p.mouse.move(win[0] - 200, win[1]); await p.mouse.move(win[0], win[1], { steps: 8 }); await sleep(900);
        const pal = await p.evaluate(() => { const r = document.querySelector('.hw__app--palette').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await p.mouse.move(pal[0], pal[1], { steps: 4 }); await p.mouse.click(pal[0], pal[1]); await sleep(1500);
        await p.mouse.move(win[0], win[1], { steps: 3 }); await sleep(500);
      } else await p.mouse.move(vp.w - 3, vp.h - 3);
      await save(id, await p.evaluate(AUDIT));
      if (id === 'hero-os') { await p.evaluate(() => { const b = document.querySelector('.hw__app[aria-pressed="true"]'); if (b) b.click(); }); await p.mouse.move(vp.w - 3, vp.h - 3); await sleep(600); }
      if (id === 'pf-dialog') { await p.keyboard.press('Escape'); await sleep(1200); }
    }
  }
  /* ---------- the other pages: the whole page, checked chunk by chunk while scrolling ---------- */
  for (const c of CELLS.filter(x => x[2] === 'page')) {
    await prep(c[3]);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    let chk = { hscroll: 0, outside: [], overlaps: [], small: [] };
    for (let y = 0; y < H; y += Math.round(vp.h * 0.85)) { await scrollTo(p, y); await frames(p, 6); await sleep(500); chk = merge(chk, await p.evaluate(AUDIT)); }
    await scrollTo(p, 0); await sleep(600);
    await save(c[0], chk, true);
  }
  await ctx.close();
}

{
  const queue = VPS.slice();
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) { const vp = queue.shift(); const t = Date.now(); await shoot(vp); console.log(`done ${vp.key} (${Math.round((Date.now() - t) / 1000)}s)`); } }));
}
await browser.close();
server.close();
fs.writeFileSync(RES_FILE, JSON.stringify(results, null, 1));

/* ---------------------------------------------------------------- the board page */
const sh = c => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ''; } };
const hash = sh('git rev-parse --short HEAD'), date = sh('git log -1 --format=%cd --date=iso');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ALLC = [
  ['hero', 'Hero'], ['hero-os', 'Hero · mini OS dock + panel open'], ['about-1', 'Rólam · start'], ['about-4', 'Rólam · end'], ['skills', 'Készségek'], ['why-1', 'Értékek · step 1'], ['why-6', 'Értékek · step 6'],
  ['steps', 'Együttműködés'], ['services', 'Szolgáltatások'], ['pf-head', 'Portfólió · heading'], ['pf-1', 'Portfólió · card 1'], ['pf-2', 'Portfólió · card 2'], ['pf-3', 'Portfólió · card 3'], ['pf-4', 'Portfólió · card 4'],
  ['pf-5', 'Portfólió · card 5'], ['pf-6', 'Portfólió · card 6'], ['pf-ig', 'Portfólió · Instagram card'], ['pf-dialog', 'Portfólió · case-study dialog open'], ['contact', 'Kapcsolat'], ['contact-form', 'Kapcsolat · form'], ['footer', 'Footer'],
  ['p-approach', 'myapproach.html (full page)'], ['p-whatsapp', 'whatsappcontact.html (full page)'], ['p-privacy', 'adatvedelem.html (full page)'],
];
const probs = r => {
  const c = r.checks, o = [];
  if (c.hscroll > 1) o.push(['hscroll', `horizontal overflow: page is ${c.hscroll}px wider than the viewport`]);
  c.outside.forEach(x => o.push(['outside', 'outside viewport: ' + x]));
  c.overlaps.forEach(x => o.push(['overlap', 'overlapping text: ' + x]));
  c.small.forEach(x => o.push(['small', 'text < 12px: ' + x]));
  r.errors.forEach(x => o.push(['console', 'console/network: ' + x]));
  return o;
};
const tally = {}; let total = 0;
for (const r of Object.values(results)) for (const [k] of probs(r)) { tally[k] = (tally[k] || 0) + 1; total++; }
const vpKeys = ALL_VPS.filter(k => Object.values(results).some(r => r.vp === k));
const cellsHtml = (id, k) => {
  const f = `${id}_${k}.jpg`, r = results[f]; if (!r) return '';
  const [w, h] = k.split('x').map(Number), pr = probs(r);
  return `<td style="--ar:${w / h}"><a class="cell${pr.length ? ' bad' : ''}" href="img/${f}" target="_blank"><img loading="lazy" src="img/${f}" alt="${esc(id + ' ' + k)}"><b class="vp">${k}</b>${pr.length ? `<em>${pr.length}</em>` : ''}</a>` +
    (pr.length ? `<ul class="pl">${pr.map(([t, m]) => `<li class="${t}">${esc(m)}</li>`).join('')}</ul>` : '<p class="ok">no problems found</p>') + '</td>';
};
const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VarBro laptop review board</title>
<style>
  :root { color-scheme: dark; --bg: #11131c; --fg: #e8e9f1; --mut: #8d92a8; --line: #2a2e42; --red: #ff5470; --th: 150px; }
  * { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px 18px; background: #0b0d14; border-bottom: 1px solid var(--line); }
  header b { font-size: 15px; } header span { color: var(--mut); } .t { color: var(--red); }
  label { display: flex; gap: 6px; align-items: center; color: var(--mut); margin-left: auto; } input[type=range] { accent-color: #8a8fff; }
  section { padding: 14px 18px 6px; border-bottom: 1px solid var(--line); } h2 { margin: 0 0 8px; font-size: 14px; }
  .row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; align-items: flex-start; } td { display: block; }
  .row > td { flex: none; width: max(calc(var(--th) * var(--ar)), 230px); }
  a.cell { position: relative; display: block; height: var(--th); width: calc(var(--th) * var(--ar)); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; line-height: 0; }
  a.cell img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  a.cell.bad { outline: 2px solid var(--red); } a.cell .vp { position: absolute; left: 4px; top: 4px; font: 600 10px/1 system-ui; padding: 3px 5px; border-radius: 4px; background: rgb(0 0 0 / .7); color: #fff; }
  a.cell em { position: absolute; right: 4px; top: 4px; font: 700 11px/1 system-ui; padding: 3px 6px; border-radius: 10px; background: var(--red); color: #fff; }
  ul.pl { margin: 5px 0 0; padding: 0; list-style: none; font-size: 11px; max-width: 360px; } ul.pl li { color: #ff9aa9; padding: 1px 0 1px 8px; border-left: 2px solid var(--red); margin-bottom: 2px; overflow-wrap: anywhere; }
  ul.pl li.small { color: #ffc27a; border-color: #ff9d3d; } ul.pl li.console { color: #ff9aa9; } p.ok { margin: 5px 0 0; font-size: 11px; color: #5fd49a; }
</style></head><body>
<header><b>VarBro laptop review board</b><span>commit <b>${hash || '—'}</b> · ${esc(date)}</span><span>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
<span class="t">${total} problem(s): ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}</span>
<label>thumbnail <input id="sz" type="range" min="80" max="420" value="150"><span id="szv">150</span>px</label></header>
${ALLC.filter(([id]) => Object.values(results).some(r => r.id === id)).map(([id, lb]) => `<section><h2>${esc(lb)}</h2><table style="display:block"><tbody style="display:block"><tr class="row">${vpKeys.map(k => cellsHtml(id, k)).join('')}</tr></tbody></table></section>`).join('\n')}
<script>var s=document.getElementById('sz'),v=document.getElementById('szv');function set(){document.documentElement.style.setProperty('--th',s.value+'px');v.textContent=s.value}s.oninput=set;set();</script>
</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`\nBoard: ${path.join(OUT, 'index.html')}\nScreenshots: ${Object.keys(results).length}, problems: ${total}  ${JSON.stringify(tally)}`);
