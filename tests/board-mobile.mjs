// Mobile / tablet review board: `node tests/board-mobile.mjs` -> board/mobile/index.html (+ img/*.jpg, results.json)  (board/ is local only: never commit it)
//   rows = sections of index.html (header, Hero, mini OS panels Zene / Paletta / Hangulat / Üzenet, Rólam, Készségek, Értékek, Együttműködés, Szolgáltatások, Portfólió heading + cards + Instagram
//          card + one open dialog, Kapcsolat, footer, opened menu, one opened service modal, cookie banner) + myapproach.html (top, cards, checklist, FAQ open, CTA) + adatvedelem.html (top, bottom);
//          columns = phones 360x780 / 390x844 / 412x915 / 430x932, tablets 768x1024 / 1024x1366 (portrait), 1024x768 / 1366x1024 (landscape); isMobile + hasTouch, deviceScaleFactor 2.
//   A tall section is shot in up to 3-4 slices (top -> bottom of its scroll range). Every slice gets an automatic check list: horizontal overflow (scrollWidth > clientWidth), text < 12px, tap targets
//   < 44x44 (inline text links excepted), content overlapping the header controls / a fixed element over the header, console errors / failed requests; plus elements outside the viewport and overlapping
//   text boxes. The flags list is at the TOP of the board (counts per viewport, then every distinct flag with the cells / viewports it appears in). Click a thumbnail to zoom.
//   Does not change any site code. Env: PW_MODULE / PW_CHROMIUM as in tests/smoke.mjs.
//   Options: --viewports=390x844,768x1024  --only=hero,menu,a-top   (partial runs merge into results.json)
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
const OUT = path.join(ROOT, 'board', 'mobile'), IMG = path.join(OUT, 'img');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain', '.xml': 'application/xml' };
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
const ALL_VPS = ['360x780', '390x844', '412x915', '430x932', '768x1024', '1024x1366', '1024x768', '1366x1024'];
const GROUP = { '360x780': 'phone', '390x844': 'phone', '412x915': 'phone', '430x932': 'phone', '768x1024': 'tablet portrait', '1024x1366': 'tablet portrait', '1024x768': 'tablet landscape', '1366x1024': 'tablet landscape' };
const VPS = (ARG('viewports').length ? ARG('viewports') : ALL_VPS).map(s => { const [w, h] = s.split('x').map(Number); return { w, h, key: s }; });

// [id, label, kind, page, maxSlices]; kind: index = index.html, page = another page
const ALLC = [
  ['header', 'Header (logo + burger)', 'index'], ['menu', 'Menu opened', 'index'], ['cookie', 'Cookie banner', 'index'],
  ['hero', 'Hero', 'index', 'index.html', 2],
  ['os-music', 'Hero · mini OS · Zene', 'index'], ['os-palette', 'Hero · mini OS · Paletta', 'index'], ['os-mood', 'Hero · mini OS · Hangulat', 'index'], ['os-msg', 'Hero · mini OS · Üzenet', 'index'],
  ['about', 'Rólam', 'index', 'index.html', 3], ['skills', 'Készségek', 'index', 'index.html', 3], ['why', 'Értékek', 'index', 'index.html', 3], ['steps', 'Együttműködés', 'index', 'index.html', 3],
  ['services', 'Szolgáltatások', 'index', 'index.html', 4], ['svc-modal', 'Szolgáltatások · service modal open', 'index'],
  ['pf-head', 'Portfólió · heading', 'index'], ['pf-1', 'Portfólió · card 1', 'index'], ['pf-2', 'Portfólió · card 2', 'index'], ['pf-3', 'Portfólió · card 3', 'index'], ['pf-4', 'Portfólió · card 4', 'index'],
  ['pf-5', 'Portfólió · card 5', 'index'], ['pf-6', 'Portfólió · card 6', 'index'], ['pf-ig', 'Portfólió · Instagram card', 'index'], ['pf-dialog', 'Portfólió · case-study dialog open', 'index'],
  ['contact', 'Kapcsolat', 'index', 'index.html', 3], ['footer', 'Footer', 'index', 'index.html', 2],
  ['a-top', 'myapproach.html · top', 'approach'], ['a-cards', 'myapproach.html · "Mit kap Ön" cards', 'approach'], ['a-need', 'myapproach.html · checklist', 'approach'], ['a-faq', 'myapproach.html · FAQ (first item open)', 'approach'], ['a-cta', 'myapproach.html · closing CTA', 'approach'],
  ['p-top', 'adatvedelem.html · top', 'privacy'], ['p-bottom', 'adatvedelem.html · bottom', 'privacy'],
];
const CELLS = ALLC.filter(c => !ARG('only').length || ARG('only').includes(c[0]));
const has = id => CELLS.some(c => c[0] === id);

const launchOpts = { headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launchOpts);
fs.mkdirSync(IMG, { recursive: true });
const RES_FILE = path.join(OUT, 'results.json');
let results = {};
try { results = JSON.parse(fs.readFileSync(RES_FILE, 'utf8')); } catch { /* first run */ }

const scrollTo = (p, y) => p.evaluate(yy => { if (window.VB && VB.lenis) VB.lenis.scrollTo(yy, { immediate: true }); else window.scrollTo(0, yy); }, y);
const frames = (p, n = 4) => p.evaluate(k => new Promise(r => { const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const rectOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top + scrollY, left: r.left, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);

/* ---- the automatic checks, run inside the page on the CURRENT viewport state (painted elements only: elementFromPoint at the centre of each box) ----
   kinds: hscroll (documentElement.scrollWidth > clientWidth), small (text < 12px), tap (tap target < 44x44, inline text links excepted), header (content over the logo / burger, or a fixed / sticky
   element over the header band), outside (a box beyond the viewport edge), overlaps (two text boxes on top of each other). Console errors are collected outside. */
const AUDIT = (opts) => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const out = { hscroll: Math.max(0, de.scrollWidth - de.clientWidth), outside: [], overlaps: [], small: [], tap: [], header: [] };
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.'); return s; };
  const txt = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const skip = e => e.closest('[aria-hidden="true"], .hero-vh, .sr-only, [inert], script, style, noscript, .cursor-ring, .cursor-dot');
  const clipped = (e, r) => { for (let a = e.parentElement; a && a !== de; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const ar = a.getBoundingClientRect(); if (r.right <= ar.left + 1 || r.left >= ar.right - 1 || r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1) return true; } } return false; };
  const painted = (e, r) => { const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t) || t.contains(e)); };
  const nav = document.querySelector('#nav, .nav'), logo = document.querySelector('.nav__logo'), burger = document.getElementById('burger');
  const inNav = e => !!(nav && nav.contains(e)) || !!e.closest('#menu, .cookie-banner, #cookie-consent-banner');
  const ctl = [logo, burger].filter(Boolean).map(e => e.getBoundingClientRect());
  const cand = [];
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const own = txt(e), media = /^(IMG|VIDEO|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName);
    const inter = e.matches('a[href], button, [role="button"], summary, input:not([type="hidden"]), select, textarea');
    if (!own && !media && !inter) continue;
    let r;
    if (own) { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter(q => q.width > 1 && q.height > 1); if (!rs.length) continue; r = { left: Math.min(...rs.map(q => q.left)), top: Math.min(...rs.map(q => q.top)), right: Math.max(...rs.map(q => q.right)), bottom: Math.max(...rs.map(q => q.bottom)) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
    else { const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue; r = { left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.width, height: q.height }; }
    if (r.bottom <= 0 || r.top >= vh) continue;
    if (skip(e) || clipped(e, r) || !painted(e, r)) continue;
    cand.push({ e, r, own, cs, inter });
  }
  for (const c of cand) {
    if (c.r.right > vw + 1 || c.r.left < -1) out.outside.push(`${sel(c.e)} ${Math.round(c.r.left)}..${Math.round(c.r.right)} (vw ${vw})`);
    if (c.own && parseFloat(c.cs.fontSize) < 12 - 0.01) out.small.push(`${sel(c.e)} ${parseFloat(c.cs.fontSize).toFixed(1)}px "${c.own.slice(0, 24)}"`);
    if (c.inter) {
      /* a checkbox / radio inside a <label>: the label is the tap target */
      const lab = /^(checkbox|radio)$/.test(c.e.type || '') ? c.e.closest('label') : null;
      const b = (lab || c.e).getBoundingClientRect();
      /* an inline link inside running text (the paragraph has other text around it) is exempt */
      const inline = c.e.tagName === 'A' && c.e.parentElement && getComputedStyle(c.e).display === 'inline' && txt(c.e.parentElement).length > 0;
      if (!inline && (b.width < 44 - 0.5 || b.height < 44 - 0.5)) out.tap.push(`${sel(c.e)} ${Math.round(b.width)}×${Math.round(b.height)} "${(c.e.getAttribute('aria-label') || c.e.textContent || c.e.getAttribute('data-lucide') || '').trim().replace(/\s+/g, ' ').slice(0, 22)}"`);
    }
    if (!opts.menu && !inNav(c.e) && (c.own || c.inter)) {
      for (const k of ctl) { const w = Math.min(c.r.right, k.right) - Math.max(c.r.left, k.left), h = Math.min(c.r.bottom, k.bottom) - Math.max(c.r.top, k.top); if (w > 2 && h > 2) { out.header.push(`${sel(c.e)} "${(c.own || c.e.getAttribute('aria-label') || '').slice(0, 20)}" under the logo / burger`); break; } }
      const pos = c.cs.position;
      if ((pos === 'fixed' || pos === 'sticky') && nav && c.r.top < nav.getBoundingClientRect().bottom - 2 && !c.e.closest('.hw, .cursor-ring')) out.header.push(`${sel(c.e)} is ${pos} over the header band`);
    }
  }
  const T = cand.filter(c => c.own);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) { const ar = Math.min(a.r.width * a.r.height, b.r.width * b.r.height); if (w * h > 40 && w * h > 0.25 * ar) out.overlaps.push(`${sel(a.e)} "${a.own.slice(0, 18)}" × ${sel(b.e)} "${b.own.slice(0, 18)}" ${Math.round(w)}×${Math.round(h)}`); }
  }
  const uniq = a => [...new Set(a)];
  out.outside = uniq(out.outside).slice(0, 8); out.small = uniq(out.small).slice(0, 12); out.overlaps = uniq(out.overlaps).slice(0, 8); out.tap = uniq(out.tap).slice(0, 14); out.header = uniq(out.header).slice(0, 8);
  return out;
};
const KINDS = ['hscroll', 'small', 'tap', 'header', 'outside', 'overlaps'];
const merge = (a, b) => { for (const k of ['outside', 'overlaps', 'small', 'tap', 'header']) a[k] = [...new Set([...(a[k] || []), ...b[k]])]; a.hscroll = Math.max(a.hscroll || 0, b.hscroll); return a; };
const emptyChecks = () => ({ hscroll: 0, outside: [], overlaps: [], small: [], tap: [], header: [] });

async function shoot(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  let errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.|unpkg|googleapis|gstatic|favicon|ERR_(INTERNET|NAME|CONNECTION|BLOCKED|NETWORK)/.test(m.text())) errs.push(m.text().slice(0, 140)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 140)));
  p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });
  const cell = { shots: [], checks: emptyChecks() };
  const begin = () => { cell.shots = []; cell.checks = emptyChecks(); };
  /* shot = one screenshot of the current state + its audit; end() stores the cell */
  const shot = async (opts = {}) => {
    const i = cell.shots.length, f = `${cell.id}_${vp.key}_${i}.jpg`;
    const clip = opts.clip ? { x: 0, y: 0, width: vp.w, height: Math.min(opts.clip, vp.h) } : undefined;
    await p.screenshot({ path: path.join(IMG, f), type: 'jpeg', quality: 70, clip });
    cell.shots.push({ f, w: vp.w, h: clip ? clip.height : vp.h });
    merge(cell.checks, await p.evaluate(AUDIT, { menu: !!opts.menu }));
  };
  const end = () => { results[`${cell.id}_${vp.key}`] = { id: cell.id, vp: vp.key, shots: cell.shots, checks: cell.checks, errors: [...new Set(errs)] }; errs = []; };
  const run = async (id, fn) => { cell.id = id; begin(); try { await fn(); } catch (e) { errs.push('board: ' + String(e.message).split('\n')[0].slice(0, 120)); } end(); };
  const settle = async (ms = 1100) => { await frames(p, 8); await sleep(ms); };
  const prep = async (url, { cookie } = {}) => {
    await p.goto(`${BASE}/${url}`, { waitUntil: 'load' });
    await p.evaluate(hide => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignore */ } if (hide) { const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; } return document.fonts.ready; }, !cookie);
    await p.waitForFunction(() => !window.VB || !VB.hasST || window.ScrollTrigger.getAll().length > 0, null, { timeout: 5000 }).catch(() => {});
    await frames(p, 6); await sleep(1200);
  };
  const walk = async () => {                                                   /* warm-up: scroll the page once top -> bottom so every once-only reveal has played, like a real visit */
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += Math.round(vp.h * 0.6)) { await scrollTo(p, y); await frames(p, 3); await sleep(110); }
    await scrollTo(p, H); await sleep(900); await scrollTo(p, 0); await sleep(900);
  };
  const tap = async sel => {                                                  /* a real touch tap; an element outside the viewport is scrolled to the middle first (a fixed element stays where it is) */
    let r = await rectOf(p, sel); if (!r) throw new Error('missing ' + sel);
    let y = r.cy;                                                            /* viewport coordinates */
    if (y < 60 || y > vp.h - 30) { if (!(await p.evaluate(s => { for (let e = document.querySelector(s); e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; }, sel))) {          /* the burger sits in the fixed header: tap it where it is */ await scrollTo(p, (await p.evaluate(() => scrollY)) + r.cy - vp.h / 2); await sleep(500); y = vp.h / 2; } }
    await p.touchscreen.tap(r.cx, y);
  };
  /* a tall section: up to `max` slices through its scroll range (a pinned story steps through its states) */
  const slices = async (sel, max) => {
    const r = await rectOf(p, sel); if (!r) throw new Error('missing ' + sel);
    const n = Math.max(1, Math.min(max, Math.ceil(r.height / vp.h)));
    for (let i = 0; i < n; i++) {
      const y = n > 1 ? r.top + i * (r.height - vp.h) / (n - 1) : Math.max(0, r.top - Math.min(40, Math.max(0, (vp.h - r.height) / 2)));
      await scrollTo(p, y); await settle(); await shot();
    }
  };

  /* ---------- index.html ---------- */
  if (CELLS.some(c => c[2] === 'index' && !['cookie'].includes(c[0]))) {
    await prep('index.html'); await walk();
    const pfTops = () => p.evaluate(() => [...document.querySelectorAll('#pf-deck .pf-case')].map(e => e.getBoundingClientRect().top + scrollY));
    for (const c of CELLS.filter(x => x[2] === 'index')) {
      const id = c[0];
      if (id === 'cookie') continue;
      if (c[3]) { await run(id, async () => slices(({ hero: '#hero', about: '#about', skills: '#skills', why: '#why', steps: '#steps', services: '#services', contact: '#contact', footer: 'footer' })[id], c[4])); continue; }
      if (id === 'header') await run(id, async () => { await scrollTo(p, 0); await settle(600); await shot({ clip: 140 }); });
      else if (id === 'menu') await run(id, async () => { await scrollTo(p, 0); await settle(600); await tap('#burger'); await p.waitForFunction(() => document.getElementById('burger').getAttribute('aria-expanded') === 'true', null, { timeout: 3000 }); await sleep(1800); await shot({ menu: true }); await tap('#burger'); await sleep(900); });
      else if (id.startsWith('os-')) {
        await run(id, async () => {
          const app = { 'os-music': 'music', 'os-palette': 'palette', 'os-mood': 'mood', 'os-msg': 'msg' }[id], sel = `.hw__app--${app}`;
          await scrollTo(p, 0); await settle(900);
          if (!(await p.evaluate(() => !!document.querySelector('.hw.is-hold')))) { await tap('.hw__win'); await sleep(1200); }       /* a tap on the living window holds the story and slides the dock up */
          await tap(sel); await sleep(1200);
          if (!(await p.evaluate(s => document.querySelector(s).getAttribute('aria-pressed') === 'true', sel))) { await p.evaluate(s => document.querySelector(s).click(), sel); await sleep(1200); }
          await sleep(900); await shot();
          await p.keyboard.press('Escape'); await sleep(500);
          if (await p.evaluate(() => !!document.querySelector('.hw__app[aria-pressed="true"]'))) await p.evaluate(() => document.querySelector('.hw__app[aria-pressed="true"]').click());
          await sleep(600);
        });
      } else if (id === 'svc-modal') {
        await run(id, async () => { await scrollTo(p, (await rectOf(p, '#services')).top); await settle(900); await tap('.service-modal-trigger'); await sleep(1500); await shot(); await p.keyboard.press('Escape'); await sleep(900); });
      } else if (id === 'pf-head') await run(id, async () => { await scrollTo(p, (await rectOf(p, '#portfolio')).top); await settle(); await shot(); });
      else if (/^pf-\d$/.test(id)) await run(id, async () => {
        const i = +id.slice(3) - 1;
        if (await p.evaluate(() => !!document.querySelector('.pf-car'))) {                      /* the swipe carousel (phones, portrait tablets): swipe it to card i */
          await scrollTo(p, (await rectOf(p, '.pf-car')).top - 80); await sleep(300);
          await p.evaluate(k => { const car = document.querySelector('.pf-car'), c = car.children; car.scrollTo({ left: c[k].offsetLeft - c[0].offsetLeft, behavior: 'instant' }); }, i);
        } else await scrollTo(p, (await pfTops())[i]);
        await settle(); await shot();
      });
      else if (id === 'pf-ig') await run(id, async () => { await scrollTo(p, (await pfTops())[6]); await settle(); await shot(); });
      else if (id === 'pf-dialog') await run(id, async () => { await scrollTo(p, (await pfTops())[0]); await settle(); await p.evaluate(() => document.querySelector('#pf-deck .pf-case__btn').click()); await sleep(2200); await shot(); await p.keyboard.press('Escape'); await sleep(1200); });
    }
  }
  if (has('cookie')) {
    await run('cookie', async () => { await prep('index.html', { cookie: true }); await sleep(2500); await shot(); });
  }
  /* ---------- myapproach.html ---------- */
  if (CELLS.some(c => c[2] === 'approach')) {
    await prep('myapproach.html'); await walk();
    for (const c of CELLS.filter(x => x[2] === 'approach')) {
      const id = c[0], at = { 'a-cards': '.ap-have', 'a-need': '.ap-need', 'a-faq': '.ap-faq', 'a-cta': '.ap-cta' }[id];
      await run(id, async () => {
        if (id === 'a-top') await scrollTo(p, 0);
        else await scrollTo(p, (await rectOf(p, at)).top - 70);
        if (id === 'a-faq') { await settle(600); await p.evaluate(() => document.querySelector('.ap-faq__item summary').click()); await sleep(700); }
        await settle(); await shot();
      });
    }
  }
  /* ---------- adatvedelem.html ---------- */
  if (CELLS.some(c => c[2] === 'privacy')) {
    await prep('adatvedelem.html'); await walk();
    for (const c of CELLS.filter(x => x[2] === 'privacy')) {
      await run(c[0], async () => {
        if (c[0] === 'p-top') await scrollTo(p, 0); else await scrollTo(p, await p.evaluate(() => document.documentElement.scrollHeight));
        await settle(); await shot();
      });
    }
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
const LABEL = Object.fromEntries(ALLC.map(c => [c[0], c[1]]));
const probs = r => {
  const c = r.checks, o = [];
  if (c.hscroll > 1) o.push(['hscroll', `horizontal overflow: scrollWidth is ${c.hscroll}px wider than clientWidth`]);
  c.small.forEach(x => o.push(['small', 'text < 12px: ' + x]));
  c.tap.forEach(x => o.push(['tap', 'tap target < 44×44: ' + x]));
  c.header.forEach(x => o.push(['header', 'overlaps the header: ' + x]));
  c.outside.forEach(x => o.push(['outside', 'outside viewport: ' + x]));
  c.overlaps.forEach(x => o.push(['overlaps', 'overlapping text: ' + x]));
  r.errors.forEach(x => o.push(['console', 'console / network / board: ' + x]));
  return o;
};
const ALLK = [...KINDS, 'console'];
const vpKeys = ALL_VPS.filter(k => Object.values(results).some(r => r.vp === k));
const tallyVp = {}; const groups = new Map(); let total = 0;
for (const r of Object.values(results)) for (const [k, m] of probs(r)) {
  total++; (tallyVp[r.vp] ||= {})[k] = (tallyVp[r.vp][k] || 0) + 1;
  const key = k + '|' + m; if (!groups.has(key)) groups.set(key, { k, m, at: new Map() });
  const g = groups.get(key); if (!g.at.has(r.id)) g.at.set(r.id, new Set()); g.at.get(r.id).add(r.vp);
}
const flagsHtml = (() => {
  const head = `<tr><th></th>${ALLK.map(k => `<th>${k}</th>`).join('')}<th>total</th></tr>`;
  const rows = vpKeys.map(v => { const t = tallyVp[v] || {}; return `<tr><th>${v} <small>${GROUP[v] || ''}</small></th>${ALLK.map(k => `<td class="${t[k] ? 'n' : ''}">${t[k] || ''}</td>`).join('')}<td><b>${Object.values(t).reduce((a, b) => a + b, 0)}</b></td></tr>`; }).join('');
  const byKind = ALLK.map(k => {
    const gs = [...groups.values()].filter(g => g.k === k).sort((a, b) => [...b.at.values()].reduce((s, x) => s + x.size, 0) - [...a.at.values()].reduce((s, x) => s + x.size, 0));
    if (!gs.length) return '';
    return `<details ${k === 'hscroll' || k === 'header' || k === 'console' ? 'open' : ''}><summary><b>${k}</b> — ${gs.length} distinct flag(s)</summary><ul>${gs.map(g => `<li><span>${esc(g.m.replace(/^[^:]+: /, ''))}</span> <em>${[...g.at.entries()].map(([id, vs]) => `<a href="#row-${id}">${esc(id)}</a> @${[...vs].join(', ')}`).join(' · ')}</em></li>`).join('')}</ul></details>`;
  }).join('');
  return `<section id="flags"><h2>Flags (${total})</h2><table class="ft">${head}${rows}</table>${byKind}</section>`;
})();
const cellHtml = (id, k) => {
  const r = results[`${id}_${k}`]; if (!r) return '<div class="col"></div>';
  const pr = probs(r);
  return `<div class="col" style="--ar:${(r.shots[0] ? r.shots[0].w / r.shots[0].h : k.split('x')[0] / k.split('x')[1])}">` +
    r.shots.map(s => `<a class="cell${pr.length ? ' bad' : ''}" href="img/${s.f}" data-zoom="img/${s.f}" style="--sar:${s.w / s.h}"><img loading="lazy" src="img/${s.f}" alt="${esc(id + ' ' + k)}"></a>`).join('') +
    (r.shots.length ? '' : '<p class="ok">no screenshot (element missing)</p>') +
    (pr.length ? `<span class="badge">${pr.length}</span><ul class="pl">${pr.map(([t, m]) => `<li class="${t}">${esc(m)}</li>`).join('')}</ul>` : (r.shots.length ? '<p class="ok">no flags</p>' : '')) + '</div>';
};
const sections = ALLC.filter(c => Object.values(results).some(r => r.id === c[0]));
const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VarBro mobile / tablet review board</title>
<style>
  :root { color-scheme: dark; --bg: #11131c; --fg: #e8e9f1; --mut: #8d92a8; --line: #2a2e42; --red: #ff5470; --th: 220px; --nvp: ${vpKeys.length}; }
  * { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; }
  header.top { position: sticky; top: 0; z-index: 6; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px 18px; background: #0b0d14; border-bottom: 1px solid var(--line); }
  header.top b { font-size: 15px; } header.top span { color: var(--mut); } .t { color: var(--red) !important; }
  label { display: flex; gap: 6px; align-items: center; color: var(--mut); margin-left: auto; } input[type=range] { accent-color: #8a8fff; }
  #flags { padding: 14px 18px; border-bottom: 2px solid var(--line); } #flags h2 { margin: 0 0 8px; font-size: 15px; }
  table.ft { border-collapse: collapse; margin-bottom: 10px; font-size: 12px; } table.ft th, table.ft td { border: 1px solid var(--line); padding: 3px 9px; text-align: right; } table.ft th:first-child { text-align: left; } table.ft small { color: var(--mut); font-weight: 400; }
  table.ft td.n { background: #3a1c26; color: #ffb3c0; font-weight: 700; }
  details { margin: 6px 0; } summary { cursor: pointer; color: var(--fg); } details ul { margin: 4px 0 8px; padding-left: 18px; font-size: 12px; } details li { margin-bottom: 3px; overflow-wrap: anywhere; } details li em { color: var(--mut); font-style: normal; } details li a { color: #8a8fff; }
  .cols { position: sticky; top: 44px; z-index: 5; display: grid; grid-template-columns: repeat(var(--nvp), max-content); gap: 12px; padding: 6px 18px; background: #0b0d14; border-bottom: 1px solid var(--line); font: 600 11px/1.2 system-ui; color: var(--mut); }
  .cols span small { display: block; font-weight: 400; opacity: .8; }
  section.sec { padding: 12px 18px 4px; border-bottom: 1px solid var(--line); } h2.sh { margin: 0 0 8px; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(var(--nvp), max-content); gap: 12px; overflow-x: auto; padding-bottom: 10px; align-items: start; }
  .col { position: relative; width: calc(var(--th) * var(--ar)); min-width: 150px; max-width: 520px; }
  a.cell { position: relative; display: block; height: var(--th); width: calc(var(--th) * var(--sar, var(--ar))); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; line-height: 0; margin-bottom: 6px; }
  a.cell img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; } a.cell.bad { outline: 2px solid var(--red); }
  .badge { position: absolute; right: 4px; top: 4px; font: 700 11px/1 system-ui; padding: 3px 6px; border-radius: 10px; background: var(--red); color: #fff; }
  ul.pl { margin: 5px 0 0; padding: 0; list-style: none; font-size: 11px; } ul.pl li { color: #ff9aa9; padding: 1px 0 1px 8px; border-left: 2px solid var(--red); margin-bottom: 2px; overflow-wrap: anywhere; }
  ul.pl li.small, ul.pl li.tap { color: #ffc27a; border-color: #ff9d3d; } ul.pl li.header { color: #e9a6ff; border-color: #c850c0; } ul.pl li.outside, ul.pl li.overlaps { color: #9ec9ff; border-color: #4f8ff0; } p.ok { margin: 5px 0 0; font-size: 11px; color: #5fd49a; }
  #lb { position: fixed; inset: 0; z-index: 20; display: none; overflow: auto; background: rgb(5 6 10 / .94); cursor: zoom-out; } #lb.on { display: block; } #lb img { display: block; margin: 0 auto; max-height: 100vh; max-width: 100%; } #lb.full img { max-height: none; max-width: none; margin: 0; cursor: zoom-out; }
  #lb small { position: fixed; left: 12px; top: 10px; color: #fff; background: rgb(0 0 0 / .6); padding: 3px 8px; border-radius: 4px; }
</style></head><body>
<header class="top"><b>VarBro mobile / tablet review board</b><span>commit <b>${hash || '—'}</b> · ${esc(date)}</span><span>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
<span class="t">${total} flag(s) — see the list below</span>
<label>thumbnail height <input id="sz" type="range" min="120" max="520" value="220"><span id="szv">220</span>px</label></header>
${flagsHtml}
<div class="cols">${vpKeys.map(k => `<span>${k}<small>${GROUP[k] || ''}</small></span>`).join('')}</div>
${sections.map(([id]) => `<section class="sec" id="row-${id}"><h2 class="sh">${esc(LABEL[id])}</h2><div class="grid">${vpKeys.map(k => cellHtml(id, k)).join('')}</div></section>`).join('\n')}
<div id="lb"><small>click: toggle full size · Esc: close</small><img alt=""></div>
<script>
var s=document.getElementById('sz'),v=document.getElementById('szv');function set(){document.documentElement.style.setProperty('--th',s.value+'px');v.textContent=s.value}s.oninput=set;set();
var lb=document.getElementById('lb'),im=lb.querySelector('img');
document.addEventListener('click',function(e){var a=e.target.closest('a[data-zoom]');if(a){e.preventDefault();im.src=a.getAttribute('data-zoom');lb.className='on';lb.scrollTop=0;return}
 if(lb.classList.contains('on')){if(e.target===im&&!lb.classList.contains('full')){lb.classList.add('full')}else{lb.className=''}}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')lb.className=''});
</script>
</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const kinds = {}; for (const r of Object.values(results)) for (const [k] of probs(r)) kinds[k] = (kinds[k] || 0) + 1;
console.log(`\nBoard: ${path.join(OUT, 'index.html')}\nCells: ${Object.keys(results).length}, flags: ${total}  ${JSON.stringify(kinds)}`);
