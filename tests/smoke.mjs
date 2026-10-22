// Regression smoke test (needs Playwright; Chromium): `node tests/smoke.mjs --quick` (default, before every commit) or `--full`; `--only=<group>` re-runs one group.
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

// ---------------------------------------------------------------- runner options
//   node tests/smoke.mjs            -> --quick (default)
//   node tests/smoke.mjs --quick    1440x900 + 390x844, index only: the checks needed before every commit
//   node tests/smoke.mjs --full     every viewport (390/768/1280/1440/1920/2560), every page, touch-laptop emulation
//   --only=<group>[,<group>]        run only these groups (in the chosen mode), e.g. --only=titles,about
const ARGS = process.argv.slice(2);
const FULL = ARGS.includes('--full');
const ONLY = (ARGS.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const CONCURRENCY = 3;
const T0 = Date.now();

// ---------------------------------------------------------------- waiting helpers (conditions, not fixed sleeps)
const frames = (p, n = 3) => p.evaluate(k => new Promise(r => { const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// resolves true as soon as `fn(arg)` is truthy in the page, false after `timeout` ms (the check that follows then reports the real state)
const until = async (p, fn, arg, timeout = 3000) => { try { await p.waitForFunction(fn, arg, { timeout, polling: 'raf' }); return true; } catch { return false; } };
// an element that finished its entrance: opaque and without a translate / scale
const SETTLED_JS = sel => { const e = document.querySelector(sel); if (!e) return false; const c = getComputedStyle(e); return parseFloat(c.opacity) >= 0.95 && (c.transform === 'none' || /^matrix\(1, 0, 0, 1, -?[\d.]+, 0(\.\d+)?\)$/.test(c.transform)); };

async function open(ctx, page, area, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(net::ERR|status of 4)/.test(m.text()) ) errs.push('console: ' + m.text().slice(0, 140)); });
  p.on('response', r => { if (isOurs(r.url()) && r.status() >= 400) errs.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
  p.on('requestfailed', r => { if (isOurs(r.url())) errs.push('failed ' + r.url().replace(BASE, '')); });
  await p.goto(`${BASE}/${page}.html`, { waitUntil: 'load' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } return document.fonts.ready; });
  // GSAP-driven pages: wait until ScrollTrigger has registered its triggers (entrance states are set after the fonts are in)
  await until(p, () => !window.VB || !VB.hasST || window.ScrollTrigger.getAll().length > 0, null, 4000);
  await frames(p, 4);
  return p;
}
const scrollTo = (p, y) => p.evaluate(yy => { if (window.VB && VB.lenis) VB.lenis.scrollTo(yy, { immediate: true }); else scrollTo(0, yy); }, y);
const topOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; }, sel);
const newCtx = (vp, extra = {}) => browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(vp.w < 500 ? { hasTouch: true, isMobile: true } : {}), ...extra });

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
  ['services', '#services .section-heading', 'visible'],
  ['portfolio', '#portfolio .section-heading', 'visible'],
  ['contact', '.contact-form-panel .btn-submit-message', 'animated'],
  ['footer', 'footer .footer-section:nth-child(3)', 'animated'],
];
const state = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const c = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { op: parseFloat(c.opacity), tf: c.transform, rect: [Math.round(r.top + scrollY), Math.round(r.height)] };
}, sel);
const settled = s => s && s.op >= 0.95 && (s.tf === 'none' || /^matrix\(1, 0, 0, 1, -?[\d.]+, 0(\.\d+)?\)$/.test(s.tf));   // no vertical offset left (a card may sit at its own translateX)

async function indexChecks(vp) {
  const tag = `index ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await newCtx(vp);
  const p = await open(ctx, 'index', tag, errs);
  const mobile = vp.w < 500;

  // sections exist
  const missing = await p.evaluate(secs => Object.entries(secs).filter(([, s]) => !document.querySelector(s)).map(([k]) => k), SECTIONS);
  rec(tag, 'all sections exist', missing.length === 0, missing.join(','));

  // initial (pre-scroll) state of the probes that start below the fold: wait until their hidden entrance states are applied
  await until(p, probes => probes.every(s => { const e = document.querySelector(s); if (!e) return true; const r = e.getBoundingClientRect(); if (r.top <= innerHeight) return true; const c = getComputedStyle(e); return parseFloat(c.opacity) < 0.95 || (c.transform !== 'none' && !/^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(c.transform)); }), PROBES.filter(x => x[2] === 'animated').map(x => x[1]), 2500);
  const pre = {};
  for (const [sec, sel] of PROBES) pre[sel] = await state(p, sel);

  // scroll through the whole page (jumps: the scroll-driven setups see every position in order)
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.5)) { await scrollTo(p, y); await frames(p, 4); }

  // each probe: scroll it into view and check the entrance fired and ended visible
  for (const [sec, sel, exp] of PROBES) {
    const before = pre[sel];
    const y = await topOf(p, sel);
    if (y == null) { rec(tag, `${sec}: ${sel}`, false, 'probe element missing'); continue; }
    await scrollTo(p, Math.max(0, y - vp.h * 0.45));
    await until(p, SETTLED_JS, sel, 3500);
    const after = await state(p, sel);
    rec(tag, `${sec}: visible after scroll`, settled(after), after ? `op ${after.op} tf ${after.tf}` : 'missing');
    if (exp === 'animated') {
      const belowFold = before && before.rect[0] > vp.h;
      const wasHidden = before && (before.op < 0.95 || !settled(before));
      rec(tag, `${sec}: scroll entrance fires (${sel.split(' ').pop()})`, !belowFold || (wasHidden && settled(after)), belowFold ? `before op ${before.op} tf ${before.tf}` : 'above the fold (skipped)');
    }
  }

  // stuck-at-zero scan: anything in the page body still inline-hidden after the full pass (excluding intentional states)
  await frames(p, 6);
  const stuck = await p.evaluate(() => [...document.querySelectorAll('main *, section *, footer *')]
    .filter(e => e.style && e.style.opacity === '0' && !e.closest('#about, .menu, .modal, .pf-modal, .service-modal-overlay, .cookie-banner, [aria-hidden="true"]') && e.getBoundingClientRect().height > 8 && !e.closest('#portfolio'))
    .map(e => (e.className && String(e.className).slice(0, 30)) || e.tagName).slice(0, 6));
  rec(tag, 'nothing stuck at opacity 0', stuck.length === 0, stuck.join(', '));

  // horizontal overflow
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  rec(tag, 'no horizontal overflow', ov <= 0, `overflow ${ov}px`);

  if (!mobile) {
    // Készségek hover (real mouse): row name moves, others dim, floating preview shows
    await scrollTo(p, (await topOf(p, '#skills')) + 40); await frames(p, 4); await scrollTo(p, (await topOf(p, '.skill-row:nth-child(3)')) - vp.h * 0.4); await frames(p, 8);   // the 3rd row sits mid-screen, whatever the heading height
    const r = await p.evaluate(() => { const e = document.querySelectorAll('.skill-row')[2].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
    const base = await p.evaluate(() => ({ t: getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform, o: getComputedStyle(document.querySelectorAll('.skill-row')[4]).opacity }));
    await p.mouse.move(60, 60); await p.mouse.move(r[0] - 80, r[1], { steps: 4 }); await p.mouse.move(r[0], r[1], { steps: 4 });
    await until(p, b => { const rows = document.querySelectorAll('.skill-row'); return getComputedStyle(rows[2].querySelector('.skill-row__name')).transform !== b.t && parseFloat(getComputedStyle(rows[4]).opacity) < parseFloat(b.o) && (innerWidth <= 900 || parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity) > 0.9); }, base, 2000);
    const hv = await p.evaluate(() => ({ t: getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform, o: getComputedStyle(document.querySelectorAll('.skill-row')[4]).opacity, pv: parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity) }));
    rec(tag, 'Készségek: row hover effect', hv.t !== base.t && parseFloat(hv.o) < parseFloat(base.o), `name ${base.t} -> ${hv.t}, others ${base.o} -> ${hv.o}`);
    if (vp.w > 900) rec(tag, 'Készségek: floating icon preview on hover', hv.pv > 0.9, `preview opacity ${hv.pv}`);   // the preview is desktop-only (> 900px, script.js)
    // ... and the preview goes away when the pointer leaves the list
    await p.mouse.move(vp.w - 30, 30, { steps: 6 });
    await until(p, () => parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity) < 0.05, null, 2000);
    const pvOff = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity));
    if (vp.w > 900) rec(tag, 'Készségek: preview hides when the pointer leaves', pvOff < 0.05, `preview opacity ${pvOff}`);

    // custom cursor after a real mouse move
    const cur = await p.evaluate(() => { const r = document.querySelector('.cursor-ring'); return { has: document.documentElement.classList.contains('has-cursor'), ring: !!r, shown: r && getComputedStyle(r).display !== 'none' && !!r.style.transform }; });
    rec(tag, 'cursor: has-cursor + ring after mouse move', cur.has && cur.ring && cur.shown, JSON.stringify(cur));
  }

  // menu: 5 items in order, 4 socials, each scrolls to its section
  const menuOk = [];
  await scrollTo(p, 0); await frames(p, 6);
  const links = [['Rólam', '#about'], ['Értékek & Garanciák', '#why'], ['Szolgáltatások', '#services'], ['Portfólió', '#portfolio'], ['Kapcsolat', '#contact']];
  await p.click('#burger'); await until(p, () => document.querySelector('#menu').classList.contains('is-open') && document.querySelectorAll('#menu .menu__link').length > 0, null, 3000); await frames(p, 6);
  const menu = await p.evaluate(() => ({ items: [...document.querySelectorAll('#menu .menu__link')].map(a => a.textContent.trim()), hrefs: [...document.querySelectorAll('#menu .menu__link')].map(a => a.getAttribute('href')), socials: document.querySelectorAll('#menu .menu__social a').length }));
  rec(tag, 'menu: five items in order', JSON.stringify(menu.items.map(s => s.toLowerCase())) === JSON.stringify(links.map(l => l[0].toLowerCase())), menu.items.join(' | '));
  rec(tag, 'menu: social icons', menu.socials === 4, `${menu.socials}`);
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('#menu').classList.contains('is-open'), null, 2000);
  if (FULL) for (const [label, hash] of links) {
    await scrollTo(p, 0); await frames(p, 6);
    await p.click('#burger'); await until(p, () => document.querySelector('#menu').classList.contains('is-open'), null, 2000); await frames(p, 8);
    await p.click(`#menu a[href="${hash}"]`);
    await until(p, h => Math.abs(Math.round(document.querySelector(h).getBoundingClientRect().top)) <= 3 && !document.querySelector('#menu').classList.contains('is-open'), hash, 6000); await frames(p, 6);
    const top = await p.evaluate(h => Math.round(document.querySelector(h).getBoundingClientRect().top), hash);
    const closed = await p.evaluate(() => !document.querySelector('#menu').classList.contains('is-open'));
    menuOk.push([label, Math.abs(top) <= 3, closed]);
  }
  if (FULL) rec(tag, 'menu: every item scrolls to its section and closes', menuOk.every(m => m[1] && m[2]), menuOk.map(m => `${m[0]}:${m[1] ? 'ok' : 'miss'}${m[2] ? '' : '/open'}`).join(' '));

  // cookie banner
  await until(p, () => { const b = document.getElementById('cookie-consent-banner'); return b && b.classList.contains('is-visible'); }, null, 4000);
  const banner = await p.evaluate(() => { const b = document.getElementById('cookie-consent-banner'); return b && b.classList.contains('is-visible'); });
  rec(tag, 'cookie banner shows on first visit', !!banner);
  if (banner) {
    await p.evaluate(() => document.getElementById('cookie-decline').click());
    await until(p, () => !document.getElementById('cookie-consent-banner').classList.contains('is-visible'), null, 2000);
    const hid = await p.evaluate(() => !document.getElementById('cookie-consent-banner').classList.contains('is-visible'));
    await p.evaluate(() => document.getElementById('cookie-settings-trigger').click());
    await until(p, () => document.getElementById('cookie-consent-banner').classList.contains('is-visible'), null, 2000);
    const re = await p.evaluate(() => document.getElementById('cookie-consent-banner').classList.contains('is-visible'));
    rec(tag, 'cookie banner closes and reopens from the footer link', hid && re, `closed ${hid}, reopened ${re}`);
  }

  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function otherPage(page, vp) {
  const tag = `${page} ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await newCtx(vp);
  const p = await open(ctx, page, tag, errs);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.6)) { await scrollTo(p, y); await frames(p, 5); }
  await until(p, () => [...document.querySelectorAll('main *, section *, footer *')].filter(e => e.style && e.style.opacity === '0' && e.getBoundingClientRect().height > 8 && !e.closest('[aria-hidden="true"], .menu, .modal, .cookie-banner')).length === 0, null, 3000);
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
  const move = async (x, y) => { await p.mouse.move(x - 60, y - 10); await p.mouse.move(x, y, { steps: 6 }); await frames(p, 6); };
  const nameT = () => p.evaluate(() => getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform);
  // cursor appears after the first real mouse move, whatever the media queries say
  await move(300, 300);
  await until(p, () => document.documentElement.classList.contains('has-cursor') && !!document.querySelector('.cursor-ring'), null, 2000);
  const cur = await p.evaluate(() => ({ has: document.documentElement.classList.contains('has-cursor'), ring: !!document.querySelector('.cursor-ring'), fine: matchMedia('(pointer: fine)').matches, hover: matchMedia('(hover: hover)').matches }));
  rec(tag, 'cursor appears after a real mouse move', cur.has && cur.ring && (coarse ? !cur.fine && !cur.hover : true), JSON.stringify(cur));
  // Készségek hover
  await scrollTo(p, (await topOf(p, '#skills')) + 40); await frames(p, 4); await scrollTo(p, (await topOf(p, '.skill-row:nth-child(3)')) - vp.h * 0.4); await frames(p, 8);   // the 3rd row sits mid-screen, whatever the heading height
  const sr = await p.evaluate(() => { const e = document.querySelectorAll('.skill-row')[2].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  await p.mouse.move(vp.w - 20, vp.h - 20, { steps: 4 }); await frames(p, 10);     // off the rows: the baseline is the un-hovered state
  const sb = await nameT();
  await move(sr[0], sr[1]);
  await until(p, b => getComputedStyle(document.querySelectorAll('.skill-row')[2].querySelector('.skill-row__name')).transform !== b, sb, 2000);
  const sh = await nameT();
  rec(tag, 'Készségek: hover effect', sh !== sb, `${sb} -> ${sh}`);
  // Készségek floating preview: shows only over a row; hides on leave and when scrolling moves the list away from a resting mouse
  const pvState = () => p.evaluate(() => { const e = document.querySelector('.skills-preview'); const s = getComputedStyle(e); const u = document.elementFromPoint(window.__mx, window.__my); return { op: parseFloat(s.opacity), vis: s.visibility, over: !!(u && u.closest('.skills-list')) }; });
  await p.evaluate(() => { window.__mx = 0; window.__my = 0; document.addEventListener('pointermove', e => { window.__mx = e.clientX; window.__my = e.clientY; }, true); });
  await move(sr[0], sr[1]);
  await until(p, () => parseFloat(getComputedStyle(document.querySelector('.skills-preview')).opacity) > 0.9, null, 2000);
  const pv1 = await pvState();
  rec(tag, 'Készségek preview: visible over a row', pv1.op > 0.9 && pv1.vis === 'visible', JSON.stringify(pv1));
  await p.mouse.move(vp.w - 30, 30, { steps: 8 });
  await until(p, () => { const s = getComputedStyle(document.querySelector('.skills-preview')); return parseFloat(s.opacity) < 0.05 && s.visibility === 'hidden'; }, null, 2000);
  const pv2 = await pvState();
  rec(tag, 'Készségek preview: hidden after the pointer leaves the list', pv2.op < 0.05 && pv2.vis === 'hidden', JSON.stringify(pv2));
  if (FULL) {
    await move(sr[0], sr[1]);
    let leaked = [], prevBad = false;   // a 0.3s fade-out right after leaving is fine; visible for two samples in a row is a leak
    for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 260); await sleep(160); const s = await pvState(); const bad = s.op > 0.1 && !s.over; if (bad && prevBad) leaked.push(i); prevBad = bad; }
    await until(p, () => { const s = getComputedStyle(document.querySelector('.skills-preview')); return parseFloat(s.opacity) < 0.05 && s.visibility === 'hidden'; }, null, 1500);
    const pv3 = await pvState();
    const inWhy = await p.evaluate(() => { const r = document.querySelector('#why').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    rec(tag, 'Készségek preview: never visible after scrolling away (wheel, resting mouse)', leaked.length === 0 && pv3.op < 0.05 && pv3.vis === 'hidden', `leaked at steps ${leaked.join(',') || '-'}; end ${JSON.stringify(pv3)}; why in view ${inWhy}`);
  }
  // Értékek & Garanciák: hovering a card does NOT open or preview anything (click opens it) and shows no cursor frame
  await scrollTo(p, (await topOf(p, '#why')) + 20);
  await until(p, () => document.querySelectorAll('.why-panel').length === 6 && document.querySelector('.why-panel').getBoundingClientRect().height > 100, null, 3000); await frames(p, 10);
  const wact = () => p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active') ? 1 : 0).join(''));
  const wgeo = () => p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => Math.round(e.getBoundingClientRect().left) + ':' + Math.round(e.getBoundingClientRect().width)).join(','));
  let g0 = await wgeo();
  for (let k = 0; k < 20; k++) { await sleep(150); const g = await wgeo(); if (g === g0) break; g0 = g; }       // the open card may still be growing: take the settled geometry
  const w0 = await wact(); const seq = [], why = [];
  for (let i = 5; i >= 0; i--) {
    const c = await p.evaluate(i => { const e = document.querySelectorAll('.why-panel')[i].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, i);
    await move(c[0], c[1]); await frames(p, 20);
    const ring = await p.evaluate(() => document.querySelector('.cursor-ring').className);
    const wa = await wact(), wg = await wgeo();
    seq.push(wa === w0 && wg === g0 && !/is-frame|is-link-small|is-text/.test(ring));
    if (!seq[seq.length - 1]) why.push(`card ${i + 1}: open ${wa === w0 ? 'same' : wa}, geometry ${wg === g0 ? 'same' : wg.slice(0, 40) + ' vs ' + g0.slice(0, 40)}, ring ${ring.slice(0, 40)}`);
  }
  rec(tag, 'Értékek: hovering any card changes nothing (no open, no layout change), no cursor frame', seq.every(Boolean), `open ${w0}, ${seq.map(Boolean).join(',')} ${why[0] || ''}`);
  if (FULL) {
    // frames still work on real targets (menu item)
    await scrollTo(p, 0); await frames(p, 6);
    await p.mouse.move(vp.w - 40, 44, { steps: 3 }); await p.click('#burger');
    await until(p, () => document.querySelector('#menu').classList.contains('is-open'), null, 2000); await frames(p, 20);
    const mb = await p.evaluate(() => { const r = document.querySelectorAll('.menu__link')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await move(mb[0], mb[1]);
    await until(p, () => /is-frame/.test(document.querySelector('.cursor-ring').className), null, 1500);
    const fr = await p.evaluate(() => document.querySelector('.cursor-ring').className);
    rec(tag, 'cursor frame on menu items', /is-frame/.test(fr), fr);
  }
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- layout: corridor, header overlap, eyebrows, mobile header
async function layoutChecks(vp) {
  const tag = `layout ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const p = await open(ctx, 'index', tag, errs);
  const hdr = await p.evaluate(() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { logo: r('.nav__logo'), burger: r('#burger') }; });
  // 1) shared corridor: left content line of every section on index
  const edges = {};
  const probes = { hero: '.hero-inner', skills: '#skills .skills-inner', why: '#why .why-inner', steps: '#steps .steps-inner', services: '.svt__inner', contact: '.ctc__head', about: '.about-premium-grid', portfolioHead: '.pf__head' };
  for (const [k, sel] of Object.entries(probes)) {
    const y = await topOf(p, sel); await scrollTo(p, Math.max(0, (y || 0) - 100)); await frames(p, 10);
    edges[k] = await p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }, sel);
  }
  // EXPERIMENT tighter anchor: Készségek has its own left line (checked separately below)
  const lefts = Object.entries(edges).filter(([k, v]) => v && k !== 'skills').map(([, e]) => e[0]);
  const gutterMin = hdr.logo[2] + 32 - 1;   // logo right edge + 32px air
  const L = lefts[0];
  rec(tag, 'all sections share one left content line', lefts.every(x => Math.abs(x - L) <= 1) && L >= gutterMin, JSON.stringify(edges));
  const rights = Object.entries(edges).filter(([k, v]) => v && k !== 'portfolioHead' && k !== 'skills').map(([, v]) => v[1]);
  const R = Math.max(...rights);
  rec(tag, 'right content lines inside the corridor and clear of the burger', rights.every(x => x <= R + 1) && R <= hdr.burger[0] - 32 + 1, `max right ${R}, burger left ${Math.round(hdr.burger[0])}`);

  // EXPERIMENT tighter anchor: Készségek content stays >= 20px right of the logo and >= 20px left of the burger
  rec(tag, 'EXPERIMENT Készségek: content line >= 20px clear of the logo and the burger', !!edges.skills && edges.skills[0] >= hdr.logo[2] + 20 - 1 && edges.skills[1] <= hdr.burger[0] - 20 + 1, `left ${edges.skills && edges.skills[0]} (logo right ${Math.round(hdr.logo[2])}), right ${edges.skills && edges.skills[1]} (burger left ${Math.round(hdr.burger[0])})`);

  // 2) the logo / burger never intersect text or cards while scrolling the page (portfolio cards and footer excepted)
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  const hits = [];
  for (let y = 0; y < H; y += Math.round(vp.h * 0.5)) {
    await scrollTo(p, y); await sleep(250);
    const h = await p.evaluate(({ logo, burger }) => {
      const out = [];
      const boxes = [logo, burger];
      document.querySelectorAll('h1,h2,h3,h4,p,li,.section-eyebrow,label,button:not(#burger):not(.footer-top-btn),input,select,textarea,a.hbtn,.svt-word,.section-heading,.hero-title,.contact-form-panel,.contact-personal-panel,.about-photo-card,.about-bio-card,.why-panel,.skill-row,.process__step,.svt-row')
        .forEach(e => {
          if (e.closest('footer, .menu, #pf-deck, .pf-modal, .cookie-banner, .nav, .skills-preview, [aria-hidden="true"]')) return;
          const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity < 0.05 || s.display === 'none') return;
          const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
          if (e.matches('.why-panel') ) { /* clipped decorative panel edges are still cards */ }
          for (const b of boxes) if (r.left < b[2] && r.right > b[0] && r.top < b[3] && r.bottom > b[1]) out.push((e.className && String(e.className).slice(0, 28)) || e.tagName);
        });
      return out;
    }, hdr);
    if (h.length) hits.push(`${y}:${[...new Set(h)].slice(0, 3).join('+')}`);
  }
  rec(tag, 'logo/burger never overlap text or cards', hits.length === 0, hits.slice(0, 4).join(' ; '));

  // 3) eyebrows: identical typography everywhere
  const eb = await p.evaluate(() => [...document.querySelectorAll('.section-eyebrow')].map(e => { const s = getComputedStyle(e), f = parseFloat(getComputedStyle(e.closest('section, .ap') || e).getPropertyValue('--fit')) || 1; return [s.fontFamily, (parseFloat(s.fontSize) * f).toFixed(2) + 'px', s.fontWeight, (parseFloat(s.letterSpacing) * f).toFixed(2) + 'px', s.textTransform, s.fontStyle].join('|'); })   /* rendered size: the fitted sections lay the eyebrow out at size / fit */);
  const eb2 = await (async () => {
    const p2 = await ctx.newPage(); await p2.goto(`${BASE}/myapproach.html`, { waitUntil: 'load' });
    /* its entrance animates the letter-spacing: wait until it reaches the common value */
    const want = (eb[0] || '').split('|')[3];
    await until(p2, w => { const e = document.querySelector('.section-eyebrow'); return !!e && getComputedStyle(e).letterSpacing === w; }, want, 4000);
    const r = await p2.evaluate(() => [...document.querySelectorAll('.section-eyebrow')].map(e => { const s = getComputedStyle(e), f = parseFloat(getComputedStyle(e.closest('section, .ap') || e).getPropertyValue('--fit')) || 1; return [s.fontFamily, (parseFloat(s.fontSize) * f).toFixed(2) + 'px', s.fontWeight, (parseFloat(s.letterSpacing) * f).toFixed(2) + 'px', s.textTransform, s.fontStyle].join('|'); })   /* rendered size: the fitted sections lay the eyebrow out at size / fit */); await p2.close(); return r;
  })();
  const all = eb.concat(eb2);
  rec(tag, 'eight section eyebrows on index + one on myapproach exist', eb.length === 8 && eb2.length === 1, `${eb.length}+${eb2.length}`);
  rec(tag, 'all eyebrows share font / size / weight / spacing / uppercase', new Set(all).size === 1 && /uppercase/.test(all[0]), [...new Set(all)].join(' || '));
  const ebTxt = await p.evaluate(() => [...document.querySelectorAll('.section-eyebrow')].map(e => e.textContent.trim()));
  rec(tag, 'eyebrow labels are written in normal case', ebTxt.every(t => t !== t.toUpperCase() || t.length < 2), ebTxt.join(' / '));
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- Rólam (About): composition size, in-flow stack, signature
async function aboutChecks(vp, wantH) {
  const tag = `about ${vp.w}x${vp.h}`;
  const errs = [];
  const mobile = vp.w < 900;
  const ctx = await newCtx(vp);
  const p = await open(ctx, 'index', tag, errs);
  const top = await topOf(p, '#about'); const sh = await p.evaluate(() => document.getElementById('about').offsetHeight);
  const stops = mobile ? [0, 0.35, 0.7, 0.95] : [-0.04, 0.02, 0.2, 0.4, 0.62, 0.85, 1.03];   // first / last: before the pin starts and after it ended
  const rows = [];
  for (const s of stops) {
    await scrollTo(p, mobile ? top + (sh - vp.h * 0.6) * s : top + (sh - vp.h) * s);
    await frames(p, 12);
    // the signature's rewrite reveal for the new chapter has finished (clip fully open)
    await until(p, () => { const s = getComputedStyle(document.querySelector('.about-sign')); const n = (s.clipPath.match(/[\d.]+/g) || []).map(parseFloat); return parseFloat(s.opacity) > 0.5 && (s.clipPath === 'none' || n.every(x => x === 0)); }, null, 2500);
    rows.push(await p.evaluate(() => {
      const R = e => e.getBoundingClientRect(); const q = s => document.querySelector(s);
      const card = R(q('.about-bio-card')), photo = R(q('.about-photo-card')), sign = R(q('.about-sign')), btn = R(q('.btn-about')), prog = R(q('.abt-progress'));
      const inter = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const bodies = [...document.querySelectorAll('.abt-ch')].map(ch => { const l = ch.querySelector('.abt-lead'), b = ch.querySelector('.abt-body'); return l && b ? R(b).top - R(l).bottom : 99; });
      const sgs = getComputedStyle(q('.about-sign'));
      const textBoxes = [...document.querySelectorAll('.abt-heading, .abt-body, .abt-lead, .abt-eyebrow')].filter(e => { const r = R(e); return r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).map(R);
      return {
        cardH: Math.round(card.height), photoH: Math.round(photo.height),
        signInside: sign.left >= card.left && sign.right <= card.right && sign.bottom <= card.bottom + 1 && sign.top >= card.top,
        signHitsBtn: inter(sign, btn), signHitsProg: inter(sign, prog), signW: Math.round(sign.width),
        signHitsText: textBoxes.some(t => inter(sign, t) && !(t.height < 2)),
        barFlowGap: Math.min(...bodies), signOpacity: parseFloat(sgs.opacity), signClip: sgs.clipPath,
        inCard: (() => { const e = q('.about-bio-card'); return !!q('.about-bio-card .abt-eyebrow') && e.querySelector('.abt-eyebrow').getBoundingClientRect().bottom <= R(q('.abt-heading')).top + 14; })(),
        // the signature's ink (incl. descenders) must be inside its own box, the box inside the card, and nothing on the way clips it
        signInk: (() => { const el = q('.about-sign'), cs = sgs, r = sign, cv = document.createElement('canvas').getContext('2d'); cv.font = `${cs.fontSize} Sacramento`; const m = cv.measureText(el.textContent);
          const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight), pt = parseFloat(cs.paddingTop), A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
          const base = r.top + pt + (lh - (A + D)) / 2 + A; const inkBottom = base + m.actualBoundingBoxDescent, inkTop = base - m.actualBoundingBoxAscent;
          const left = r.left + parseFloat(cs.paddingLeft) - m.actualBoundingBoxLeft, right = r.left + parseFloat(cs.paddingLeft) + m.actualBoundingBoxRight;
          let clipped = cs.clipPath !== 'none' || cs.overflow !== 'visible' || cs.maskImage !== 'none'; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if ((s.overflow !== 'visible' && a.matches('.about-bio-card, .abt')) || s.clipPath !== 'none') clipped = true; if (a.matches('.about-bio-card')) break; }
          return { descentSpace: +(r.bottom - inkBottom).toFixed(1), ascentSpace: +(inkTop - r.top).toFixed(1), leftSpace: +(left - r.left).toFixed(1), rightSpace: +(r.right - right).toFixed(1), clipped, fonts: document.fonts.check(cs.fontSize + ' Sacramento') }; })(),
        h2lines: Math.round(R(q('.abt-heading')).height / parseFloat(getComputedStyle(q('.abt-heading')).lineHeight)),
      };
    }));
  }
  const hs = new Set(rows.map(r => r.cardH));
  if (!mobile && wantH != null) rec(tag, 'composition height', rows.every(r => r.photoH === wantH && r.cardH === wantH), `photo ${rows.map(r => r.photoH).join('/')} card ${rows.map(r => r.cardH).join('/')} (want ${wantH})`);
  rec(tag, 'text card height constant across chapters', hs.size === 1, [...hs].join(','));
  rec(tag, 'signature inside the card, not over the button / segments / text', rows.every(r => r.signInside && !r.signHitsBtn && !r.signHitsProg && !r.signHitsText), JSON.stringify(rows.map(r => [r.signInside, r.signHitsBtn, r.signHitsProg, r.signHitsText])));
  rec(tag, 'signature always visible: opacity >= 0.85, no clip-path (every chapter, before and after the pin)', rows.every(r => r.signOpacity >= 0.85 && r.signClip === 'none'), rows.map(r => `${r.signOpacity}/${r.signClip}`).join(','));
  rec(tag, 'signature not clipped: ink incl. descenders inside its box, nothing clips it', rows.every(r => r.signInk.fonts && !r.signInk.clipped && r.signInk.descentSpace >= 0 && r.signInk.ascentSpace >= 0 && r.signInk.leftSpace >= -0.5 && r.signInk.rightSpace >= -0.5), JSON.stringify(rows[0].signInk));
  rec(tag, 'eyebrow "Rólam" sits inside the text card, directly above the heading', rows.every(r => r.inCard), rows.map(r => r.inCard).join(','));
  rec(tag, 'accent bar stays in flow (body starts below the lead + bar)', rows.every(r => r.barFlowGap >= -1)   /* the lead block includes the bar + its 18px margin, so the body must start at or below its bottom edge */, rows.map(r => Math.round(r.barFlowGap)).join(','));
  rec(tag, 'heading max two lines', rows.every(r => r.h2lines <= 2), rows.map(r => r.h2lines).join(','));
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- section title system: typography, top anchor, left line
async function titleSystem(vp) {
  const tag = `titles ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await newCtx(vp);
  const SECS = [
    ['hero', 'index', '#hero', '.hero-eyebrow', '.hero-title', '.hero-sub', true],
    ['about', 'index', '#about', '.abt-eyebrow', null, '.about-photo-card', true],
    ['skills', 'index', '#skills', '#skills .section-eyebrow', '#skills .section-heading', '#skills .skills-list', true],
    ['why', 'index', '#why', '#why .section-eyebrow', '#why .section-heading', '#why .why-panels', true],
    ['steps', 'index', '#steps', '#steps .section-eyebrow', '#steps .section-heading', '#steps .process', true],
    ['services', 'index', '#services', '.svt-eyebrow', '#services .section-heading', '.svt-row', true],
    ['portfolio', 'index', '#portfolio', '.pf__eyebrow', '#portfolio .section-heading', '.pf__sub', true],
    ['contact', 'index', '#contact', '.ctc-eyebrow', '#contact .section-heading', '.contact-grid', true],
    ['myapproach', 'myapproach', '.ap', '.ap-eyebrow', null, '.ap-grid', true],
  ];
  const pages = {}; const rows = [];
  for (const [name, page, sec, eye, head, first] of SECS) {
    let p = pages[page];
    if (!p) { p = pages[page] = await open(ctx, page, tag, errs); await p.evaluate(() => { const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; }); await frames(p, 4); }
    await p.evaluate(s => {
      const e = document.querySelector(s); const pinned = (e.id === 'about' && e.classList.contains('is-pinned')) || (e.id === 'steps' && getComputedStyle(e.querySelector('.steps-pin') || e).position === 'sticky');
      const y = e.getBoundingClientRect().top + scrollY + (pinned ? 40 : 0);
      if (window.VB && VB.lenis) VB.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
    }, sec);
    await frames(p, 8);
    // the eyebrow (and heading) finished their entrance: opaque, no translate, final letter-spacing
    await until(p, ([eye, head]) => {
      const done = sel => { const e = document.querySelector(sel); if (!e) return true; const c = getComputedStyle(e); return parseFloat(c.opacity) >= 0.95 && (c.transform === 'none' || /^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(c.transform)); };
      const eb = document.querySelector(eye), ecs = eb && getComputedStyle(eb), h = head && document.querySelector(head);
      return done(eye) && (!head || done(head)) && (!eb || Math.abs(parseFloat(ecs.letterSpacing) - 0.2 * parseFloat(ecs.fontSize)) < 0.008) && (!h || !h.classList.contains('section-heading') || h.classList.contains('is-split'));
    }, [eye, head], 3500);
    rows.push({ name, ...(await p.evaluate(([sec, eye, head, first]) => {
      const R = e => e.getBoundingClientRect(); const s = document.querySelector(sec), e = document.querySelector(eye);
      const pinned = (s.id === 'about' && s.classList.contains('is-pinned')) || (s.id === 'steps' && getComputedStyle(s.querySelector('.steps-pin') || s).position === 'sticky');
      const cs = getComputedStyle(e);
      return { top: R(e).top - (pinned ? 0 : R(s).top), left: R(e).left, typo: (() => { const f = parseFloat(getComputedStyle(s).getPropertyValue('--fit')) || 1; return [cs.fontFamily, (parseFloat(cs.fontSize) * f).toFixed(2) + 'px', cs.fontWeight, (parseFloat(cs.letterSpacing) * f).toFixed(2) + 'px', cs.textTransform, (parseFloat(cs.lineHeight) * f).toFixed(1) + 'px'].join('|'); })(),   // rendered values (fitted sections lay the eyebrow out at size / fit); spacing rounded: an entrance may still be settling   // spacing rounded: an eyebrow entrance may still be settling by a few thousandths
        headTypo: head ? (() => { const h = document.querySelector(head), hs = getComputedStyle(h), fit = parseFloat(getComputedStyle(s).getPropertyValue('--fit')) || 1, fs = parseFloat(hs.fontSize) * fit;
          return { sig: [hs.fontFamily, hs.fontWeight, hs.textTransform, (parseFloat(hs.letterSpacing) / parseFloat(hs.fontSize)).toFixed(3), (parseFloat(hs.lineHeight) / parseFloat(hs.fontSize)).toFixed(3)].join('|'), fs, lineH: h.querySelector('.sh-word') ? R(h.querySelector('.sh-word')).height : 0, dots: h.querySelectorAll('.sh-dot').length, split: h.classList.contains('is-split'), aria: !!h.getAttribute('aria-label'), right: Math.max(...[...h.querySelectorAll('.sh-word')].map(x => R(x).right)) }; })() : null,
        headLeft: head ? R(document.querySelector(head)).left : null, firstLeft: R(document.querySelector(first)).left, clientW: document.documentElement.clientWidth,
        gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-gutter')) || 0, hdr: innerWidth < 768 ? 76 : 92 };
    }, [sec, eye, head, first])) });
  }
  const r0 = rows[0];
  const expTop = r0.hdr + Math.min(56, Math.max(24, 0.04 * vp.h));
  // content corridor left line: the gutter, or the centred 1152px column when the viewport is wider
  const gutterPx = vp.w >= 1024 ? 32 + 44 + 32 : 20;
  const maxW = Math.min(1480, Math.max(1152, 0.78 * vp.w));          // --content-max: clamp(1152px, 78vw, 1480px)
  const expLeft = gutterPx + Math.max(0, (r0.clientW - 2 * gutterPx - maxW) / 2);
  rec(tag, 'eyebrow typography identical in all sections', new Set(rows.map(r => r.typo)).size === 1, [...new Set(rows.map(r => r.typo))].join(' || '));
  // Rólam is the one exception to the anchor system: its eyebrow lives inside the white text card (typography is still checked above)
  // EXPERIMENT tighter anchor: Készségek is a temporary exception too (its anchor is overridden in the EXPERIMENT block of style.css)
  const anchored = rows.filter(r => r.name !== 'about' && r.name !== 'skills');
  const badTop = anchored.filter(r => Math.abs(r.top - expTop) > 1.5).map(r => `${r.name}:${Math.round(r.top)}`);
  rec(tag, `eyebrow top = section top + ${Math.round(expTop)}px in every section (except Rólam)`, badTop.length === 0, badTop.join(' '));
  const badLeft = anchored.filter(r => Math.abs(r.left - expLeft) > 1.5).map(r => `${r.name}:${Math.round(r.left)}`);
  rec(tag, `eyebrow left = content corridor (${Math.round(expLeft)}px) (except Rólam)`, badLeft.length === 0, badLeft.join(' '));
  const hr = rows.filter(r => r.headTypo && !['hero'].includes(r.name));
  rec(tag, 'section headings: same font / weight / uppercase / letter-spacing / line-height', new Set(hr.map(r => r.headTypo.sig)).size === 1, [...new Set(hr.map(r => r.headTypo.sig))].join(' || '));
  const fss = hr.map(r => r.headTypo.fs);
  rec(tag, 'section headings: identical rendered size in all 6', Math.max(...fss) - Math.min(...fss) < 0.6, hr.map(r => `${r.name}:${r.headTypo.fs.toFixed(1)}`).join(' '));
  const lhs = hr.map(r => r.headTypo.lineH);
  rec(tag, 'section headings: identical RENDERED line height in all 6 (transforms cannot hide a smaller heading)', Math.max(...lhs) - Math.min(...lhs) < 0.6, hr.map(r => `${r.name}:${r.headTypo.lineH.toFixed(1)}`).join(' '));
  rec(tag, 'section headings: split in letters, accent dot, aria-label', hr.length === 6 && hr.every(r => r.headTypo.split && r.headTypo.dots === 1 && r.headTypo.aria), hr.map(r => `${r.name}:${r.headTypo.split}/${r.headTypo.dots}/${r.headTypo.aria}`).join(' '));
  rec(tag, 'section headings: no word sticks out of the viewport', hr.every(r => r.headTypo.right <= r.clientW + 0.5), hr.map(r => `${r.name}:${Math.round(r.headTypo.right)}`).join(' '));
  const badHead = rows.filter(r => r.headLeft != null && Math.abs(r.headLeft - r.left) > 1.5).map(r => `${r.name}:${Math.round(r.headLeft)}`);
  rec(tag, 'heading left = eyebrow left', badHead.length === 0, badHead.join(' '));
  const badFirst = anchored.filter(r => Math.abs(r.firstLeft - r.left) > 1.5).map(r => `${r.name}:${Math.round(r.firstLeft)}`);
  rec(tag, 'first content block left = eyebrow left', badFirst.length === 0, badFirst.join(' '));
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function headingFx(vp, mouse) {
  const tag = `headingFx ${vp.w}x${vp.h}${mouse ? '' : ' touch'}`;
  const errs = [];
  const ctx = await newCtx(vp, mouse ? {} : {});
  const p = await open(ctx, 'index', tag, errs);
  await p.evaluate(() => { const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; });
  for (const sec of ['skills', 'why', 'steps', 'services', 'portfolio', 'contact']) {
    await p.evaluate(s => { const e = document.querySelector('#' + s + ' .section-heading'); const y = e.getBoundingClientRect().top + scrollY - innerHeight * 0.35; if (window.VB && VB.lenis) VB.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y); }, sec);
    // letters exist and their reveal (Kapcsolat: letters rise) is over
    await until(p, s => { const cs = [...document.querySelectorAll('#' + s + ' .section-heading .sh-char')]; return cs.length > 0 && cs.every(c => { const t = getComputedStyle(c).transform; return t === 'none' || /^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(t); }); }, sec, 4000);
    await frames(p, 6);
    if (mouse) {
      const pt = await p.evaluate(s => { const h = document.querySelector('#' + s + ' .section-heading'); const c = h.querySelector('.sh-char'); const r = c.parentNode.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sec);
      await p.mouse.move(pt[0] - 160, pt[1] - 20); await p.mouse.move(pt[0], pt[1], { steps: 6 });
      await until(p, s => (parseFloat(document.querySelector('#' + s + ' .section-heading .sh-char').style.getPropertyValue('--p')) || 0) > 0.4, sec, 3000);
      const v = await p.evaluate(s => { const h = document.querySelector('#' + s + ' .section-heading'); const c = h.querySelector('.sh-char'); return { p: parseFloat(c.style.getPropertyValue('--p')) || 0, tf: getComputedStyle(c).transform }; }, sec);
      rec(tag, `hover effect fires on #${sec} heading`, v.p > 0.4 && v.tf !== 'none', `p=${v.p} transform=${v.tf}`);
      await p.mouse.move(2, vp.h - 2, { steps: 4 });
      await until(p, s => Math.max(...[...document.querySelectorAll('#' + s + ' .section-heading .sh-char')].map(c => parseFloat(c.style.getPropertyValue('--p')) || 0)) < 0.02, sec, 5000);
      const off = await p.evaluate(s => Math.max(...[...document.querySelectorAll('#' + s + ' .section-heading .sh-char')].map(c => parseFloat(c.style.getPropertyValue('--p')) || 0)), sec);
      rec(tag, `hover effect releases on #${sec} heading`, off < 0.02, `max p=${off}`);
    } else {
      const v = await p.evaluate(s => { const h = document.querySelector('#' + s + ' .section-heading'); const c = h.querySelector('.sh-char'); const r = c.parentNode.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sec);
      await p.touchscreen.tap(v[0], v[1]); await frames(p, 20);
      const m = await p.evaluate(s => Math.max(...[...document.querySelectorAll('#' + s + ' .section-heading .sh-char')].map(c => parseFloat(c.style.getPropertyValue('--p')) || 0)), sec);
      rec(tag, `no hover effect on touch (#${sec})`, m === 0, `max p=${m}`);
    }
  }
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- Értékek & Garanciák: pinned stage with scroll-driven cards (>= 1024px)
async function whyPin(vp) {
  const tag = `whyPin ${vp.w}x${vp.h}`;
  const errs = [];
  const ctx = await newCtx(vp, vp.w < 1024 ? { hasTouch: true } : {});       // tablets / phones: touch (tap)
  const p = await open(ctx, 'index', tag, errs);
  await p.evaluate(() => { const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; });
  const pinnedWanted = vp.w >= 1024;
  const isPinned = await until(p, () => document.getElementById('why').classList.contains('is-pinned'), null, pinnedWanted ? 4000 : 800);
  rec(tag, pinnedWanted ? 'section pins (>= 1024px)' : 'section is not pinned (< 1024px)', isPinned === pinnedWanted, `is-pinned ${isPinned}`);
  const info = await p.evaluate(() => { const s = document.getElementById('why'); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight, pb: parseFloat(getComputedStyle(s).paddingBottom), vh: innerHeight }; });
  const sb = Math.min(Math.max(48, 0.09 * vp.h), 104);                    // --section-bottom: clamp(48px, 9svh, 104px)
  if (!pinnedWanted) {
    rec(tag, 'not pinned: bottom padding = --section-bottom', Math.abs(info.pb - sb) <= 2, `padding-bottom ${info.pb.toFixed(1)} want ${sb.toFixed(1)}`);
    // unpinned: a tap opens a card directly (one at a time), tapping the open card closes it, Enter opens too
    await p.evaluate(y => VB.lenis.scrollTo(y, { immediate: true }), info.top); await frames(p, 8);
    const openList = () => p.evaluate(() => [...document.querySelectorAll('.why-panel')].map((e, i) => e.classList.contains('is-active') ? i + 1 : 0).filter(Boolean).join(','));
    const tapTab = async i => { await p.evaluate(i => document.querySelectorAll('.why-panel')[i].querySelector('.why-panel__tab').scrollIntoView({ block: 'center' }), i); await frames(p, 4); await p.tap(`.why-panel:nth-child(${i + 1}) .why-panel__tab`); await frames(p, 8); };
    await tapTab(2); const t1 = await openList();
    await tapTab(4); const t2 = await openList();
    let t3 = '';
    if (vp.w < 768) { await tapTab(4); t3 = await openList(); }                    // stacked accordion: tapping the open card closes it (the row layout of 768-1023px keeps one open)
    await p.evaluate(() => document.querySelectorAll('.why-panel')[3].querySelector('.why-panel__tab').focus({ preventScroll: true })); await p.keyboard.press('Enter'); await frames(p, 8); const t4 = await openList();
    const ex = await p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => e.querySelector('.why-panel__tab').getAttribute('aria-expanded') === String(e.classList.contains('is-active'))).every(Boolean));
    rec(tag, 'tap opens a card (one at a time; phones: tapping the open card closes it), Enter opens', t1 === '3' && t2 === '5' && t3 === '' && t4 === '4' && ex, `${t1} | ${t2} | ${t3 || '-'} | ${t4} | aria in sync ${ex}`);
    rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close(); return;
  }
  const L = vp.h * 0.7;
  const active = () => p.evaluate(() => [...document.querySelectorAll('.why-panel')].map((e, i) => e.classList.contains('is-active') ? i + 1 : 0).filter(Boolean).join(','));
  const go = async rel => { await p.evaluate(y => VB.lenis.scrollTo(y, { immediate: true }), info.top + rel); await frames(p, 6); };
  const atStep = async k => {
    await go(k * L + 4);
    await until(p, i => document.querySelectorAll('.why-panel')[i].classList.contains('is-active') && document.querySelectorAll('.why-panel.is-active').length === 1, k, 2500);
    await until(p, i => { const a = document.querySelectorAll('.why-panel')[i].getBoundingClientRect().width, o = document.querySelectorAll('.why-panel')[(i + 1) % 6].getBoundingClientRect().width; return a > o * 3; }, k, 2500);
    return active();
  };
  // pin length + geometry at step 1
  rec(tag, 'pin length = 6 x 70svh (+ one 100svh stage)', Math.abs(info.h - info.vh - 4.2 * vp.h) <= 2, `run ${info.h - info.vh}px = ${((info.h - info.vh) / vp.h).toFixed(2)}svh`);
  await atStep(0);
  const g = await p.evaluate(() => { const s = document.getElementById('why'), r = s.querySelector('.why-inner').getBoundingClientRect(), pn = s.querySelector('.why-panels').getBoundingClientRect(), hd = s.querySelector('.section-heading').getBoundingClientRect(); return { top: r.top, h: r.height, cardsH: pn.height, bottomGap: innerHeight - pn.bottom, headGap: pn.top - hd.bottom }; });
  rec(tag, 'stage sticks to the viewport and is exactly one viewport tall', Math.abs(g.top) <= 1 && Math.abs(g.h - vp.h) <= 1, JSON.stringify({ top: g.top, h: g.h }));
  rec(tag, 'bottom gap (cards -> viewport bottom) = --section-bottom ±2px', Math.abs(g.bottomGap - sb) <= 2, `gap ${g.bottomGap.toFixed(1)} want ${sb.toFixed(1)}`);
  const lab = await p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => { const l = e.querySelector('.why-panel__label').getBoundingClientRect(), n = e.querySelector('.why-panel__num').getBoundingClientRect(), r = e.getBoundingClientRect(); return { fs: getComputedStyle(e.querySelector('.why-panel__label')).fontSize, bottomPad: r.bottom - l.bottom, aboveNum: l.top - n.bottom, inside: l.left >= r.left - 0.5 && l.right <= r.right + 0.5 }; }));
  rec(tag, 'vertical labels fit the collapsed cards (>= 16px bottom padding, below the number, one shared size)', lab.every(x => x.bottomPad >= 16 && x.aboveNum >= 4 && x.inside) && new Set(lab.map(x => x.fs)).size === 1, lab.map(x => `${x.fs}/${x.bottomPad.toFixed(0)}/${x.aboveNum.toFixed(0)}`).join(' '));
  rec(tag, 'cards keep their minimum height', g.cardsH >= 240, `${Math.round(g.cardsH)}px`);
  rec(tag, 'composition fits one viewport: cards end --section-bottom above the bottom edge, heading not shrunk', g.cardsH >= 240 ? Math.abs(g.bottomGap - sb) <= 2 : true, `bottom gap ${g.bottomGap.toFixed(1)} want ${sb.toFixed(1)}, cards ${Math.round(g.cardsH)}px`);
  // scroll steps in order, then in reverse
  const up = []; for (let k = 0; k < 6; k++) up.push(await atStep(k));
  rec(tag, 'scrolling opens cards 01 -> 06 in order (one open at a time)', up.join('|') === '1|2|3|4|5|6', up.join('|'));
  const down = []; for (let k = 5; k >= 0; k--) down.push(await atStep(k));
  rec(tag, 'scrolling back opens cards 06 -> 01', down.join('|') === '6|5|4|3|2|1', down.join('|'));
  await go(info.h - info.vh + 300); await until(p, () => document.querySelectorAll('.why-panel')[5].classList.contains('is-active'), null, 2000);
  rec(tag, 'leaving the pin at the bottom: card 06 stays open', (await active()) === '6', await active());
  await go(-300); await until(p, () => document.querySelectorAll('.why-panel')[0].classList.contains('is-active'), null, 2000);
  rec(tag, 'leaving the pin at the top: card 01 is open', (await active()) === '1', await active());
  // wheel + snap: never left between two steps, no half-open card
  await go(0); await p.mouse.move(vp.w - 60, vp.h / 2);
  const snaps = [];
  for (const d of [380, 700]) {
    await p.mouse.wheel(0, d);
    await sleep(500);
    await until(p, () => !VB.lenis.isScrolling, null, 3500);
    await sleep(450);                                     // the settle (snap) starts 160ms after the scroll stops and lasts 0.4s
    await until(p, () => !VB.lenis.isScrolling, null, 3000); await frames(p, 10);
    const rel = (await p.evaluate(() => window.pageYOffset)) - info.top, near = Math.round(rel / L);
    snaps.push([Math.abs(rel - near * L) <= 3, near, await active()]);
  }
  rec(tag, 'snap: a wheel scroll settles exactly on a step with that card open', snaps.every(s => s[0] && s[2] === String(s[1] + 1)), JSON.stringify(snaps));
  const widths = await p.evaluate(() => { const w = [...document.querySelectorAll('.why-panel')].map(e => e.getBoundingClientRect().width); const a = document.querySelector('.why-panel.is-active').getBoundingClientRect().width; return { open: a, closed: w.filter(x => x !== a).map(Math.round) }; });
  rec(tag, 'snap: no half-open card (all closed cards equally narrow)', Math.max(...widths.closed) - Math.min(...widths.closed) <= 2 && widths.open > 3 * Math.max(...widths.closed), JSON.stringify(widths));
  // hover does nothing: moving over every card changes neither the open card nor the layout
  const cur = await active();
  const geo = () => p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => Math.round(e.getBoundingClientRect().left) + ':' + Math.round(e.getBoundingClientRect().width)).join(','));
  let geo0 = await geo();
  for (let k = 0; k < 20; k++) { await sleep(150); const g = await geo(); if (g === geo0) break; geo0 = g; }
  let hoverOk = true, ringOk = true;
  for (let i = 0; i < 6; i++) {
    const pt = await p.evaluate(i => { const e = document.querySelectorAll('.why-panel')[i].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, i);
    await p.mouse.move(pt[0] - 25, pt[1] + 5); await p.mouse.move(pt[0], pt[1], { steps: 4 }); await frames(p, 20);
    if ((await active()) !== cur || (await geo()) !== geo0) hoverOk = false;
    if (/is-frame|is-link-small|is-text/.test(await p.evaluate(() => document.querySelector('.cursor-ring') ? document.querySelector('.cursor-ring').className : ''))) ringOk = false;
  }
  await p.mouse.move(vp.w / 2, 30, { steps: 4 }); await frames(p, 10);
  rec(tag, 'hovering every card changes nothing (no open, no preview, no layout change, no cursor frame)', hoverOk && ringOk && (await active()) === cur, `open ${cur} -> ${await active()}, geometry same ${hoverOk}, ring ok ${ringOk}`);
  // click scrolls to the step of that card
  const tab = await p.evaluate(() => { const e = document.querySelectorAll('.why-panel')[4].querySelector('.why-panel__tab').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  await p.mouse.move(tab[0] - 30, tab[1]); await p.mouse.move(tab[0], tab[1], { steps: 4 });
  await p.evaluate(() => document.querySelectorAll('.why-panel')[4].querySelector('.why-panel__tab').click());
  await until(p, () => !VB.lenis.isScrolling && document.querySelectorAll('.why-panel')[4].classList.contains('is-active'), null, 4000); await frames(p, 8);
  const relC = (await p.evaluate(() => window.pageYOffset)) - info.top;
  rec(tag, 'clicking a card scrolls to the step of that card', Math.abs(relC - 4 * L) <= 3 && (await active()) === '5', `rel ${Math.round(relC)} want ${Math.round(4 * L)}, open ${await active()}`);
  // Enter on a focused collapsed card does the same (keyboard)
  await p.evaluate(() => document.querySelectorAll('.why-panel')[2].querySelector('.why-panel__tab').focus({ preventScroll: true }));
  await p.keyboard.press('Enter');
  await until(p, () => !VB.lenis.isScrolling && document.querySelectorAll('.why-panel')[2].classList.contains('is-active'), null, 4000); await frames(p, 8);
  const relE = (await p.evaluate(() => window.pageYOffset)) - info.top;
  rec(tag, 'Enter on a focused card scrolls to its step and opens it', Math.abs(relE - 2 * L) <= 3 && (await active()) === '3', `rel ${Math.round(relE)} want ${Math.round(2 * L)}, open ${await active()}`);
  const aria = await p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => { const t = e.querySelector('.why-panel__tab'); return t.tagName + ':' + t.getAttribute('aria-expanded') + ':' + !!document.getElementById(t.getAttribute('aria-controls')); }).join(' '));
  rec(tag, 'cards are buttons with aria-expanded (only the open one true) and a valid aria-controls', /^(BUTTON:(true|false):true ?){6}$/.test(aria) && (aria.match(/:true:/g) || []).length === 1, aria);
  // the next section starts normally after the pin
  await p.evaluate(() => { VB.lenis.scrollTo(document.getElementById('steps').getBoundingClientRect().top + scrollY, { immediate: true }); });
  await frames(p, 10);
  const sx = await p.evaluate(() => { const s = document.getElementById('steps'), pin = s.querySelector('.steps-pin') || s, e = s.querySelector('.section-eyebrow').getBoundingClientRect(); return { top: e.top - (getComputedStyle(pin).position === 'sticky' ? 0 : s.getBoundingClientRect().top) }; });
  const expTop = (vp.w < 768 ? 76 : 92) + Math.min(56, Math.max(24, 0.04 * vp.h));
  rec(tag, 'next section (Együttműködés) starts at its normal anchor after the pin', Math.abs(sx.top - expTop) <= 2, `eyebrow ${sx.top.toFixed(1)} want ${expTop.toFixed(1)}`);
  rec(tag, 'no console errors / failed requests', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function mobileHeader(vp) {
  const tag = `mobile header ${vp.w}x${vp.h}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await p.goto(`${BASE}/index.html`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await frames(p, 6);
  await p.evaluate(() => { const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; });
  const st = () => p.evaluate(() => {
    const n = document.querySelector('.nav'); const r = n.getBoundingClientRect(); const b = getComputedStyle(n, '::before');
    const logo = document.querySelector('.nav__logo').getBoundingClientRect(), burger = document.querySelector('#burger').getBoundingClientRect();
    const at = (x, y) => document.elementFromPoint(x, y);
    return { top: Math.round(r.top), transformNone: getComputedStyle(n).transform === 'none', blur: parseFloat(b.opacity), filter: (b.backdropFilter || b.webkitBackdropFilter || ''), y: Math.round(scrollY),
      logoHit: !!at(logo.left + logo.width / 2, logo.top + logo.height / 2)?.closest('.nav__logo'), burgerHit: !!at(burger.left + burger.width / 2, burger.top + burger.height / 2)?.closest('#burger') };
  });
  const top = await st();
  rec(tag, 'blur layer is fully transparent at the top', top.blur < 0.05 && top.top === 0, JSON.stringify(top));
  await scrollTo(p, 800);
  await until(p, () => parseFloat(getComputedStyle(document.querySelector('.nav'), '::before').opacity) > 0.95, null, 2500); await frames(p, 4);
  const mid = await st();
  rec(tag, 'header stays in view after scrolling down 800px', mid.top === 0 && mid.transformNone, JSON.stringify(mid));
  rec(tag, 'blur layer fades in once scrolled (backdrop blur)', mid.blur > 0.95 && /blur/.test(mid.filter), `opacity ${mid.blur}, filter ${mid.filter}`);
  rec(tag, 'logo and burger are clickable', mid.logoHit && mid.burgerHit, `${mid.logoHit}/${mid.burgerHit}`);
  await scrollTo(p, 2400); await sleep(400);   // a hide-on-scroll regression would show up within a few frames
  const down = await st();
  rec(tag, 'header never hides while scrolling further down', down.top === 0 && down.transformNone && down.blur > 0.95, JSON.stringify(down));
  await p.evaluate(() => document.querySelector('#burger').click());
  await until(p, () => document.querySelector('#menu').classList.contains('is-open') && parseFloat(getComputedStyle(document.querySelector('.nav'), '::before').opacity) < 0.05, null, 2500);
  const open = await p.evaluate(() => ({ open: document.querySelector('#menu').classList.contains('is-open'), top: Math.round(document.querySelector('.nav').getBoundingClientRect().top), blur: parseFloat(getComputedStyle(document.querySelector('.nav'), '::before').opacity) }));
  rec(tag, 'menu opens; header visible above the overlay without the blur layer', open.open && open.top === 0 && open.blur < 0.05, JSON.stringify(open));
  await ctx.close();
}

async function touchTapWhy() {
  const ctx = await newCtx({ w: 390, h: 844 });
  const p = await ctx.newPage(); await p.goto(`${BASE}/index.html`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await frames(p, 6);
  await scrollTo(p, (await topOf(p, '#why')) + 10);
  await until(p, () => document.querySelectorAll('.why-panel').length === 6 && document.querySelector('.why-panel:nth-child(4) .why-panel__tab').getBoundingClientRect().height > 20, null, 3000); await frames(p, 8);
  const idx = 3;
  await p.tap(`.why-panel:nth-child(${idx + 1}) .why-panel__tab`);
  await until(p, i => document.querySelectorAll('.why-panel')[i].classList.contains('is-active'), idx, 2000);
  const open = await p.evaluate(i => document.querySelectorAll('.why-panel')[i].classList.contains('is-active'), idx);
  rec('touch 390x844', 'Értékek: tap opens a card', open, `${open}`);
  await ctx.close();
}

async function touchCursorOff() {
  const ctx = await newCtx({ w: 390, h: 844 });
  const p = await ctx.newPage(); await p.goto(`${BASE}/index.html`, { waitUntil: 'load' }); await frames(p, 6);
  const cd = await ctx.newCDPSession(p);
  await cd.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 300 }] });
  await cd.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);   // negative check: give a wrong cursor time to appear
  const s = await p.evaluate(() => ({ has: document.documentElement.classList.contains('has-cursor'), ring: !!document.querySelector('.cursor-ring') }));
  rec('touch', 'cursor stays off with touch emulation', !s.has && !s.ring, JSON.stringify(s));
  await ctx.close();
}

// ---------------------------------------------------------------- groups + runner
// ---------------------------------------------------------------- viewport sets (see CLAUDE.md "Viewports")
const V = (w, h) => ({ w, h });
const QUICK_VPS = [V(390, 844), V(1366, 768), V(1440, 900), V(1518, 670)];       // 1518x670 = the owner's real browser viewport (1920x1080 screen at 125% scaling)
const FULL_VPS = [V(360, 800), V(390, 844), V(430, 932), V(768, 1024), V(1280, 720), V(1366, 768), V(1536, 864), V(1440, 900), V(1920, 1080), V(1518, 670)];
const key = v => `${v.w}x${v.h}`;
const inQuick = v => QUICK_VPS.some(q => key(q) === key(v));
const isDesktop = v => v.w >= 1024;
const isPhone = v => v.w < 500;
const COMPOSITION_H = { '1440x900': 640, '1920x1080': 570 };       // About composition height known for these windows only
// one task per viewport: the quick set runs in --quick, the rest of the standard set only in --full
function perVp(name, vps, fn, weight = 1) {
  const q = [], x = [];
  for (const v of vps) (inQuick(v) ? q : x).push([`${name} ${key(v)}`, () => fn(v), weight]);
  return [q, x];
}
const GROUPS = {
  // group: [quick tasks, extra tasks run only with --full]; every task is [label, async fn, weight (heavier first)]
  index: perVp('index', FULL_VPS, indexChecks, 3),
  whypin: perVp('whyPin', FULL_VPS, whyPin, 3),
  layout: perVp('layout', FULL_VPS.filter(isDesktop), layoutChecks, 3),
  hover: (([q, x]) => [q, [...x, ['hover touch-laptop 1440x900', () => hoverChecks(V(1440, 900), true), 2]]])(perVp('hover', FULL_VPS.filter(isDesktop), v => hoverChecks(v, false), 2)),
  about: perVp('about', FULL_VPS, v => aboutChecks(v, isPhone(v) ? 0 : (COMPOSITION_H[key(v)] ?? null)), 2),
  titles: (([q, x]) => [q, [...x, ['titles 2560x1440', () => titleSystem(V(2560, 1440)), 1]]])(perVp('titles', FULL_VPS, titleSystem, 1)),
  headingfx: [[['headingFx 1440x900 mouse', () => headingFx(V(1440, 900), true), 2], ['headingFx 390x844 touch', () => headingFx(V(390, 844), false), 2]],
              [['headingFx 1366x768 mouse', () => headingFx(V(1366, 768), true), 2], ['headingFx 1518x670 mouse', () => headingFx(V(1518, 670), true), 2], ['headingFx 1920x1080 mouse', () => headingFx(V(1920, 1080), true), 2]]],
  header: perVp('mobile header', FULL_VPS.filter(isPhone), mobileHeader, 1),
  touch: [[['touch cursor', touchCursorOff, 1], ['touch tap Értékek', touchTapWhy, 1]], []],
  pages: [[], ['myapproach', 'adatvedelem', 'whatsappcontact'].flatMap(pg => [[`${pg} 1440x900`, () => otherPage(pg, V(1440, 900)), 1], [`${pg} 390x844`, () => otherPage(pg, V(390, 844)), 1]])],
};
const unknown = ONLY.filter(g => !GROUPS[g]);
if (unknown.length) { console.error(`Unknown group(s): ${unknown.join(', ')}. Groups: ${Object.keys(GROUPS).join(', ')}`); await browser.close(); server.close(); process.exit(2); }
const tasks = [];
for (const [g, [quick, extra]] of Object.entries(GROUPS)) { if (ONLY.length && !ONLY.includes(g)) continue; tasks.push(...quick, ...(FULL ? extra : [])); }
tasks.sort((a, b) => (b[2] || 1) - (a[2] || 1));          // heavy tasks first: the three workers stay busy to the end

const timings = [];
async function runTask([label, fn]) {
  const t = Date.now();
  try { await fn(); } catch (e) { rec(label, 'test run completed', false, String(e).slice(0, 200)); }
  timings.push([label, Date.now() - t]);
}
{
  const queue = tasks.slice();
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => { while (queue.length) await runTask(queue.shift()); }));
}
await browser.close(); server.close();

// ---------------------------------------------------------------- report
const order = []; for (const r of results) if (!order.includes(r.area)) order.push(r.area);
results.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
const w = Math.max(...results.map(r => r.name.length), 10);
let fails = 0;
console.log('\n' + 'RESULT'.padEnd(7) + 'AREA'.padEnd(20) + 'CHECK'.padEnd(w + 2) + 'DETAIL');
for (const r of results) {
  if (!r.ok) fails++;
  console.log((r.ok ? 'PASS' : 'FAIL').padEnd(7) + r.area.padEnd(20) + r.name.padEnd(w + 2) + (r.ok && !process.env.SMOKE_VERBOSE ? '' : r.detail));
}
{
  const rows = new Map();
  for (const r of results) {
    const m = /(\d{3,4})x(\d{3,4})/.exec(r.area); const k = m ? `${m[1]}x${m[2]}` : 'other';
    const e = rows.get(k) || { n: 0, f: 0, bad: new Set() }; e.n++; if (!r.ok) { e.f++; e.bad.add(r.area.replace(/\s*\d{3,4}x\d{3,4}.*$/, '').trim() + ': ' + r.name.slice(0, 50)); } rows.set(k, e);
  }
  console.log('\nPER VIEWPORT');
  console.log('viewport'.padEnd(11) + 'checks'.padEnd(8) + 'failed'.padEnd(8) + 'status');
  for (const [k, e] of [...rows].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) console.log(k.padEnd(11) + String(e.n).padEnd(8) + String(e.f).padEnd(8) + (e.f ? 'FAIL  ' + [...e.bad].slice(0, 3).join(' | ') : 'ok'));
}
console.log(`\n${results.length - fails}/${results.length} passed${fails ? `, ${fails} FAILED` : ''}   [${FULL ? 'full' : 'quick'}${ONLY.length ? ' --only=' + ONLY.join(',') : ''}, ${tasks.length} tasks, ${CONCURRENCY} parallel]`);
if (process.env.SMOKE_VERBOSE || fails) console.log('slowest tasks: ' + timings.sort((a, b) => b[1] - a[1]).slice(0, 5).map(t => `${t[0]} ${(t[1] / 1000).toFixed(0)}s`).join(', '));
console.log(`Total duration: ${((Date.now() - T0) / 1000).toFixed(1)}s`);
process.exit(fails ? 1 : 0);
