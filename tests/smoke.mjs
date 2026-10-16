// Regression smoke test: `node tests/smoke.mjs` (needs Playwright; Chromium).
// Serves the repo with a tiny static server, drives the real pages and prints a PASS/FAIL table; exit code 1 on any FAIL.
// Env: SMOKE_ROOT=<dir to test (default: repo root)>, PW_CHROMIUM=<path to a chromium binary, optional>.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
// Playwright is found via (in order): PW_MODULE (path to the playwright package), normal resolution, the global npm root.
let chromium;
{
  const tries = [];
  if (process.env.PW_MODULE) tries.push(() => require(process.env.PW_MODULE));
  tries.push(() => require('playwright'), () => require('playwright-core'));
  tries.push(() => require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
  for (const t of tries) { try { ({ chromium } = t()); break; } catch { /* next */ } }
  if (!chromium) { console.error('Playwright not found. `npm i -D playwright` (or set PW_MODULE=/path/to/playwright).'); process.exit(2); }
}

const ROOT = path.resolve(process.env.SMOKE_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webm': 'video/webm', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const rec = (area, name, ok, detail = '') => results.push({ area, name, ok, detail });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const launchOpts = { headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launchOpts);

// third-party hosts are not ours to fail on (CDNs / analytics / fonts may be blocked in CI)
const isOurs = u => u.startsWith(BASE);

async function open(ctx, page, area, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(net::ERR|status of 4)/.test(m.text()) ) errs.push('console: ' + m.text().slice(0, 140)); });
  p.on('response', r => { if (isOurs(r.url()) && r.status() >= 400) errs.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
  p.on('requestfailed', r => { if (isOurs(r.url())) errs.push('failed ' + r.url().replace(BASE, '')); });
  await p.goto(`${BASE}/${page}.html`, { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await sleep(500);
  return p;
}
const scrollTo = (p, y) => p.evaluate(yy => { if (window.VB && VB.lenis) VB.lenis.scrollTo(yy, { immediate: true }); else scrollTo(0, yy); }, y);
const topOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; }, sel);

// ---------------------------------------------------------------- per-viewport checks on index.html
const SECTIONS = {
  hero: '#hero', about: '#about', skills: '#skills', steps: '#steps', services: '#services',
  portfolio: '#portfolio', why: '#why', contact: '#contact', footer: 'footer',
};
// [section, probe selector, expectation]: elements that have an entrance and must END fully visible
const PROBES = [
  ['hero', '.hero-title', 'visible'],
  ['about', '#abt-eyebrow', 'visible'],
  ['skills', '#skills .skills-list > li:nth-child(5)', 'animated'],
  ['skills', '#skills .skills-head h2', 'animated'],
  ['why', '#why .why-panel:nth-child(3)', 'animated'],
  ['steps', '#steps .steps-head h2', 'animated'],
  ['services', '.svt-title', 'visible'],
  ['portfolio', '.pf__title', 'visible'],
  ['contact', '.contact-form-panel .btn-submit-message', 'animated'],
  ['footer', 'footer .footer-section:nth-child(3)', 'animated'],
];
const state = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const c = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { op: parseFloat(c.opacity), tf: c.transform, rect: [Math.round(r.top + scrollY), Math.round(r.height)] };
}, sel);
const settled = s => s && s.op >= 0.95 && (s.tf === 'none' || /^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(s.tf));

async function indexChecks(vp) {
  const tag = `index ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(vp.w < 500 ? { hasTouch: true, isMobile: true } : {}) });
  const p = await open(ctx, 'index', tag, errs);
  const mobile = vp.w < 500;

  // sections exist
  const missing = await p.evaluate(secs => Object.entries(secs).filter(([, s]) => !document.querySelector(s)).map(([k]) => k), SECTIONS);
  rec(tag, 'all sections exist', missing.length === 0, missing.join(','));

  // initial (pre-scroll) state of the probes that start below the fold
  await sleep(1500);                      // let the entrance states (set after fonts are ready) settle before sampling
  const pre = {};
  for (const [sec, sel] of PROBES) pre[sel] = await state(p, sel);

  // scroll through the whole page slowly
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.5)) { await scrollTo(p, y); await sleep(mobile ? 160 : 220); }
  await sleep(400);

  // each probe: scroll it into view and check the entrance fired and ended visible
  for (const [sec, sel, exp] of PROBES) {
    const before = pre[sel];
    const y = await topOf(p, sel);
    if (y == null) { rec(tag, `${sec}: ${sel}`, false, 'probe element missing'); continue; }
    await scrollTo(p, Math.max(0, y - vp.h * 0.45)); await sleep(2600);
    const after = await state(p, sel);
    rec(tag, `${sec}: visible after scroll`, settled(after), after ? `op ${after.op} tf ${after.tf}` : 'missing');
    if (exp === 'animated') {
      const belowFold = before && before.rect[0] > vp.h;
      const wasHidden = before && (before.op < 0.95 || !settled(before));
      rec(tag, `${sec}: scroll entrance fires (${sel.split(' ').pop()})`, !belowFold || (wasHidden && settled(after)), belowFold ? `before op ${before.op} tf ${before.tf}` : 'above the fold (skipped)');
    }
  }

  // stuck-at-zero scan: anything in the page body still inline-hidden after the full pass (excluding intentional states)
  await sleep(500);
  const stuck = await p.evaluate(() => [...document.querySelectorAll('main *, section *, footer *')]
    .filter(e => e.style && e.style.opacity === '0' && !e.closest('#about, .menu, .modal, .pf-modal, .service-modal-overlay, .cookie-banner, [aria-hidden="true"]') && e.getBoundingClientRect().height > 8 && !e.closest('#portfolio'))
    .map(e => (e.className && String(e.className).slice(0, 30)) || e.tagName).slice(0, 6));
  rec(tag, 'nothing stuck at opacity 0', stuck.length === 0, stuck.join(', '));

  // horizontal overflow
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  rec(tag, 'no horizontal overflow', ov <= 0, `overflow ${ov}px`);

  if (!mobile) {
    // Készségek hover (real mouse): row name moves, others dim, floating preview shows
    await scrollTo(p, (await topOf(p, '#skills')) + 40); await sleep(1500);
    const r = await p.evaluate(() => { const e = document.querySelectorAll('.skill-row')[2].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
    const base = await p.evaluate(() => ({ t: getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform, o: getComputedStyle(document.querySelectorAll('.skill-row')[4]).opacity }));
    await p.mouse.move(60, 60); await p.mouse.move(r[0] - 80, r[1], { steps: 4 }); await p.mouse.move(r[0], r[1], { steps: 4 }); await sleep(900);
    const hv = await p.evaluate(() => ({ t: getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform, o: getComputedStyle(document.querySelectorAll('.skill-row')[4]).opacity, pv: parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity) }));
    rec(tag, 'Készségek: row hover effect', hv.t !== base.t && parseFloat(hv.o) < parseFloat(base.o), `name ${base.t} -> ${hv.t}, others ${base.o} -> ${hv.o}`);
    rec(tag, 'Készségek: floating icon preview on hover', hv.pv > 0.9, `preview opacity ${hv.pv}`);

    // custom cursor after a real mouse move
    const cur = await p.evaluate(() => { const r = document.querySelector('.cursor-ring'); return { has: document.documentElement.classList.contains('has-cursor'), ring: !!r, shown: r && getComputedStyle(r).display !== 'none' && !!r.style.transform }; });
    rec(tag, 'cursor: has-cursor + ring after mouse move', cur.has && cur.ring && cur.shown, JSON.stringify(cur));
  }

  // menu: 5 items in order, 4 socials, each scrolls to its section
  const menuOk = [];
  await scrollTo(p, 0); await sleep(500);
  const links = [['Rólam', '#about'], ['Értékek & Garanciák', '#why'], ['Szolgáltatások', '#services'], ['Portfólió', '#portfolio'], ['Kapcsolat', '#contact']];
  await p.click('#burger'); await sleep(1200);
  const menu = await p.evaluate(() => ({ items: [...document.querySelectorAll('#menu .menu__link')].map(a => a.textContent.trim()), hrefs: [...document.querySelectorAll('#menu .menu__link')].map(a => a.getAttribute('href')), socials: document.querySelectorAll('#menu .menu__social a').length }));
  rec(tag, 'menu: five items in order', JSON.stringify(menu.items.map(s => s.toLowerCase())) === JSON.stringify(links.map(l => l[0].toLowerCase())), menu.items.join(' | '));
  rec(tag, 'menu: social icons', menu.socials === 4, `${menu.socials}`);
  await p.keyboard.press('Escape'); await sleep(700);
  for (const [label, hash] of links) {
    await scrollTo(p, 0); await sleep(500);
    await p.click('#burger'); await sleep(1000);
    await p.click(`#menu a[href="${hash}"]`); await sleep(3000);
    const top = await p.evaluate(h => Math.round(document.querySelector(h).getBoundingClientRect().top), hash);
    const closed = await p.evaluate(() => !document.querySelector('#menu').classList.contains('is-open'));
    menuOk.push([label, Math.abs(top) <= 3, closed]);
  }
  rec(tag, 'menu: every item scrolls to its section and closes', menuOk.every(m => m[1] && m[2]), menuOk.map(m => `${m[0]}:${m[1] ? 'ok' : 'miss'}${m[2] ? '' : '/open'}`).join(' '));

  // cookie banner
  const banner = await p.evaluate(() => { const b = document.getElementById('cookie-consent-banner'); return b && b.classList.contains('is-visible'); });
  rec(tag, 'cookie banner shows on first visit', !!banner);
  if (banner) {
    await p.evaluate(() => document.getElementById('cookie-decline').click()); await sleep(500);
    const hid = await p.evaluate(() => !document.getElementById('cookie-consent-banner').classList.contains('is-visible'));
    await p.evaluate(() => document.getElementById('cookie-settings-trigger').click()); await sleep(500);
    const re = await p.evaluate(() => document.getElementById('cookie-consent-banner').classList.contains('is-visible'));
    rec(tag, 'cookie banner closes and reopens from the footer link', hid && re, `closed ${hid}, reopened ${re}`);
  }

  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function otherPage(page, vp) {
  const tag = `${page} ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(vp.w < 500 ? { hasTouch: true, isMobile: true } : {}) });
  const p = await open(ctx, page, tag, errs);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.6)) { await scrollTo(p, y); await sleep(200); }
  await sleep(1500);
  const info = await p.evaluate(() => ({
    ov: document.documentElement.scrollWidth - innerWidth,
    stuck: [...document.querySelectorAll('main *, section *, footer *')].filter(e => e.style && e.style.opacity === '0' && e.getBoundingClientRect().height > 8 && !e.closest('[aria-hidden="true"], .menu, .modal, .cookie-banner')).length,
    h1: !!document.querySelector('h1'),
    legal: !!document.querySelector('.footer-legal a, .page-legal a'),
    menu: document.querySelectorAll('#menu .menu__link').length,
  }));
  rec(tag, 'renders (h1, menu, legal footer)', info.h1 && info.menu === 5 && info.legal, JSON.stringify(info));
  rec(tag, 'nothing stuck at opacity 0', info.stuck === 0, `${info.stuck}`);
  rec(tag, 'no horizontal overflow', info.ov <= 0, `${info.ov}px`);
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// A touch-screen laptop: Chromium with touch enabled reports pointer: coarse / hover: none (and maxTouchPoints > 0),
// yet a real mouse is in hand. Hover effects must still work (they follow html.has-cursor / pointerType, never media queries).
const COARSE_ENV = () => { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 10 }); };
async function hoverChecks(vp, coarse) {
  const tag = `${coarse ? 'touch-laptop' : 'desktop'} ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(coarse ? { hasTouch: true } : {}) });
  if (coarse) await ctx.addInitScript(COARSE_ENV);
  const p = await open(ctx, 'index', tag, errs);
  const move = async (x, y) => { await p.mouse.move(x - 60, y - 10); await p.mouse.move(x, y, { steps: 6 }); await sleep(700); };
  // cursor appears after the first real mouse move, whatever the media queries say
  await move(300, 300);
  const cur = await p.evaluate(() => ({ has: document.documentElement.classList.contains('has-cursor'), ring: !!document.querySelector('.cursor-ring'), fine: matchMedia('(pointer: fine)').matches, hover: matchMedia('(hover: hover)').matches }));
  rec(tag, 'cursor appears after a real mouse move', cur.has && cur.ring && (coarse ? !cur.fine && !cur.hover : true), JSON.stringify(cur));
  // Készségek hover
  await scrollTo(p, (await topOf(p, '#skills')) + 40); await sleep(1500);
  const sr = await p.evaluate(() => { const e = document.querySelectorAll('.skill-row')[2].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  const sb = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform);
  await move(sr[0], sr[1]);
  const sh = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform);
  rec(tag, 'Készségek: hover effect', sh !== sb, `${sb} -> ${sh}`);
  // Értékek & Garanciák: hover expands, previous collapses, leaving restores, no cursor frame
  await scrollTo(p, (await topOf(p, '#why')) + 20); await sleep(2200);
  const n = await p.evaluate(() => document.querySelectorAll('.why-panel').length);
  const seq = [];
  for (let i = n - 1; i >= 0; i--) {
    const c = await p.evaluate(i => { const e = document.querySelectorAll('.why-panel')[i].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, i);
    await move(c[0], c[1]);
    const st = await p.evaluate(i => ({ act: [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active')), ring: document.querySelector('.cursor-ring').className }), i);
    seq.push(st.act.filter(Boolean).length === 1 && st.act[i] && !/is-frame|is-link-small|is-text/.test(st.ring));
  }
  rec(tag, 'Értékek: every card expands on hover, one open, no cursor frame', n === 6 && seq.every(Boolean), `${n} cards, ${seq.map(Boolean).join(',')}`);
  await p.mouse.move(40, 40, { steps: 6 }); await sleep(900);
  const rest = await p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active')));
  rec(tag, 'Értékek: leaving the row restores the default card', rest[0] && rest.filter(Boolean).length === 1, rest.join(','));
  // frames still work on real targets (menu item)
  await scrollTo(p, 0); await sleep(500);
  await p.mouse.move(vp.w - 40, 44, { steps: 3 }); await p.click('#burger'); await sleep(1300);
  const mb = await p.evaluate(() => { const r = document.querySelectorAll('.menu__link')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await move(mb[0], mb[1]);
  const fr = await p.evaluate(() => document.querySelector('.cursor-ring').className);
  rec(tag, 'cursor frame on menu items', /is-frame/.test(fr), fr);
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function touchTapWhy() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' }); await sleep(500);
  await scrollTo(p, (await topOf(p, '#why')) + 10); await sleep(1800);
  const idx = 3;
  await p.tap(`.why-panel:nth-child(${idx + 1}) .why-panel__tab`); await sleep(900);
  const open = await p.evaluate(i => document.querySelectorAll('.why-panel')[i].classList.contains('is-active'), idx);
  rec('touch 390x844', 'Értékek: tap opens a card', open, `${open}`);
  await ctx.close();
}

async function touchCursorOff() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const cd = await ctx.newCDPSession(p);
  await cd.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 300 }] });
  await cd.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(500);
  const s = await p.evaluate(() => ({ has: document.documentElement.classList.contains('has-cursor'), ring: !!document.querySelector('.cursor-ring') }));
  rec('touch', 'cursor stays off with touch emulation', !s.has && !s.ring, JSON.stringify(s));
  await ctx.close();
}

try {
  await indexChecks({ w: 1440, h: 900 });
  await indexChecks({ w: 390, h: 844 });
  for (const pg of ['myapproach', 'adatvedelem', 'whatsappcontact']) { await otherPage(pg, { w: 1440, h: 900 }); await otherPage(pg, { w: 390, h: 844 }); }
  await touchCursorOff();
  await touchTapWhy();
  await hoverChecks({ w: 1440, h: 900 }, false);
  await hoverChecks({ w: 1920, h: 1080 }, false);
  await hoverChecks({ w: 1440, h: 900 }, true);
} catch (e) {
  rec('harness', 'test run completed', false, String(e).slice(0, 200));
}
await browser.close(); server.close();

// ---------------------------------------------------------------- report
const w = Math.max(...results.map(r => r.name.length), 10);
let fails = 0;
console.log('\n' + 'RESULT'.padEnd(7) + 'AREA'.padEnd(20) + 'CHECK'.padEnd(w + 2) + 'DETAIL');
for (const r of results) {
  if (!r.ok) fails++;
  console.log((r.ok ? 'PASS' : 'FAIL').padEnd(7) + r.area.padEnd(20) + r.name.padEnd(w + 2) + (r.ok && !process.env.SMOKE_VERBOSE ? '' : r.detail));
}
console.log(`\n${results.length - fails}/${results.length} passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);
