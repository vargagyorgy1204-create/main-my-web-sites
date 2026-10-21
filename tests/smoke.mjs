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
const SETTLED_JS = sel => { const e = document.querySelector(sel); if (!e) return false; const c = getComputedStyle(e); return parseFloat(c.opacity) >= 0.95 && (c.transform === 'none' || /^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(c.transform)); };

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
const settled = s => s && s.op >= 0.95 && (s.tf === 'none' || /^matrix\(1, 0, 0, 1, 0(\.\d+)?, 0(\.\d+)?\)$/.test(s.tf));

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
  // Értékek & Garanciák: hover expands, previous collapses, leaving restores, no cursor frame
  await scrollTo(p, (await topOf(p, '#why')) + 20);
  await until(p, () => document.querySelectorAll('.why-panel').length === 6 && document.querySelector('.why-panel').getBoundingClientRect().height > 100, null, 3000); await frames(p, 10);
  const n = await p.evaluate(() => document.querySelectorAll('.why-panel').length);
  const seq = [];
  for (let i = n - 1; i >= 0; i--) {
    const c = await p.evaluate(i => { const e = document.querySelectorAll('.why-panel')[i].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, i);
    await move(c[0], c[1]);
    await until(p, i => document.querySelectorAll('.why-panel')[i].classList.contains('is-active') && [...document.querySelectorAll('.why-panel')].filter(e => e.classList.contains('is-active')).length === 1, i, 1500);
    const st = await p.evaluate(i => ({ act: [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active')), ring: document.querySelector('.cursor-ring').className }), i);
    seq.push(st.act.filter(Boolean).length === 1 && st.act[i] && !/is-frame|is-link-small|is-text/.test(st.ring));
  }
  rec(tag, 'Értékek: every card expands on hover, one open, no cursor frame', n === 6 && seq.every(Boolean), `${n} cards, ${seq.map(Boolean).join(',')}`);
  await p.mouse.move(40, 40, { steps: 6 });
  await until(p, () => { const a = [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active')); return a[0] && a.filter(Boolean).length === 1; }, null, 2000);
  const rest = await p.evaluate(() => [...document.querySelectorAll('.why-panel')].map(e => e.classList.contains('is-active')));
  rec(tag, 'Értékek: leaving the row restores the default card', rest[0] && rest.filter(Boolean).length === 1, rest.join(','));
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
  const lefts = Object.values(edges).filter(Boolean).map(e => e[0]);
  const gutterMin = hdr.logo[2] + 32 - 1;   // logo right edge + 32px air
  const L = lefts[0];
  rec(tag, 'all sections share one left content line', lefts.every(x => Math.abs(x - L) <= 1) && L >= gutterMin, JSON.stringify(edges));
  const rights = Object.entries(edges).filter(([k, v]) => v && k !== 'portfolioHead').map(([, v]) => v[1]);
  const R = Math.max(...rights);
  rec(tag, 'right content lines inside the corridor and clear of the burger', rights.every(x => x <= R + 1) && R <= hdr.burger[0] - 32 + 1, `max right ${R}, burger left ${Math.round(hdr.burger[0])}`);

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
  const eb = await p.evaluate(() => [...document.querySelectorAll('.section-eyebrow')].map(e => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.textTransform, s.fontStyle].join('|'); }));
  const eb2 = await (async () => {
    const p2 = await ctx.newPage(); await p2.goto(`${BASE}/myapproach.html`, { waitUntil: 'load' });
    /* its entrance animates the letter-spacing: wait until it reaches the common value */
    const want = (eb[0] || '').split('|')[3];
    await until(p2, w => { const e = document.querySelector('.section-eyebrow'); return !!e && getComputedStyle(e).letterSpacing === w; }, want, 4000);
    const r = await p2.evaluate(() => [...document.querySelectorAll('.section-eyebrow')].map(e => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.textTransform, s.fontStyle].join('|'); })); await p2.close(); return r;
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
  const stops = mobile ? [0, 0.35, 0.7, 0.95] : [0.02, 0.2, 0.4, 0.62, 0.85];
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
        h2lines: Math.round(R(q('.abt-heading')).height / parseFloat(getComputedStyle(q('.abt-heading')).lineHeight)),
      };
    }));
  }
  const hs = new Set(rows.map(r => r.cardH));
  if (!mobile) rec(tag, 'composition height', rows.every(r => r.photoH === wantH && r.cardH === wantH), `photo ${rows.map(r => r.photoH).join('/')} card ${rows.map(r => r.cardH).join('/')} (want ${wantH})`);
  rec(tag, 'text card height constant across chapters', hs.size === 1, [...hs].join(','));
  rec(tag, 'signature inside the card, not over the button / segments / text', rows.every(r => r.signInside && !r.signHitsBtn && !r.signHitsProg && !r.signHitsText), JSON.stringify(rows.map(r => [r.signInside, r.signHitsBtn, r.signHitsProg, r.signHitsText])));
  rec(tag, 'signature visible in every chapter', rows.every(r => r.signOpacity > 0.5 && !/inset\(0px 100%/.test(r.signClip.replace(/ /g, ''))), rows.map(r => `${r.signOpacity}`).join(','));
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
      return { top: R(e).top - (pinned ? 0 : R(s).top), left: R(e).left, typo: [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.letterSpacing, cs.textTransform, cs.lineHeight].join('|'),
        headTypo: head ? (() => { const h = document.querySelector(head), hs = getComputedStyle(h), fit = parseFloat(getComputedStyle(s).getPropertyValue('--fit')) || 1, fs = parseFloat(hs.fontSize) * fit;
          return { sig: [hs.fontFamily, hs.fontWeight, hs.textTransform, (parseFloat(hs.letterSpacing) / parseFloat(hs.fontSize)).toFixed(3), (parseFloat(hs.lineHeight) / parseFloat(hs.fontSize)).toFixed(3)].join('|'), fs, dots: h.querySelectorAll('.sh-dot').length, split: h.classList.contains('is-split'), aria: !!h.getAttribute('aria-label'), right: Math.max(...[...h.querySelectorAll('.sh-word')].map(x => R(x).right)) }; })() : null,
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
  const badTop = rows.filter(r => Math.abs(r.top - expTop) > 1.5).map(r => `${r.name}:${Math.round(r.top)}`);
  rec(tag, `eyebrow top = section top + ${Math.round(expTop)}px in every section`, badTop.length === 0, badTop.join(' '));
  const badLeft = rows.filter(r => Math.abs(r.left - expLeft) > 1.5).map(r => `${r.name}:${Math.round(r.left)}`);
  rec(tag, `eyebrow left = content corridor (${Math.round(expLeft)}px)`, badLeft.length === 0, badLeft.join(' '));
  const hr = rows.filter(r => r.headTypo && !['hero'].includes(r.name));
  rec(tag, 'section headings: same font / weight / uppercase / letter-spacing / line-height', new Set(hr.map(r => r.headTypo.sig)).size === 1, [...new Set(hr.map(r => r.headTypo.sig))].join(' || '));
  const fss = hr.map(r => r.headTypo.fs);
  rec(tag, 'section headings: identical rendered size in all 6', Math.max(...fss) - Math.min(...fss) < 0.6, hr.map(r => `${r.name}:${r.headTypo.fs.toFixed(1)}`).join(' '));
  rec(tag, 'section headings: split in letters, accent dot, aria-label', hr.length === 6 && hr.every(r => r.headTypo.split && r.headTypo.dots === 1 && r.headTypo.aria), hr.map(r => `${r.name}:${r.headTypo.split}/${r.headTypo.dots}/${r.headTypo.aria}`).join(' '));
  rec(tag, 'section headings: no word sticks out of the viewport', hr.every(r => r.headTypo.right <= r.clientW + 0.5), hr.map(r => `${r.name}:${Math.round(r.headTypo.right)}`).join(' '));
  const badHead = rows.filter(r => r.headLeft != null && Math.abs(r.headLeft - r.left) > 1.5).map(r => `${r.name}:${Math.round(r.headLeft)}`);
  rec(tag, 'heading left = eyebrow left', badHead.length === 0, badHead.join(' '));
  const badFirst = rows.filter(r => Math.abs(r.firstLeft - r.left) > 1.5).map(r => `${r.name}:${Math.round(r.firstLeft)}`);
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

async function mobileHeader() {
  const tag = 'mobile header 390x844';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
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
const VP = { phone: { w: 390, h: 844 }, tablet: { w: 768, h: 1024 }, laptop: { w: 1280, h: 720 }, desk: { w: 1440, h: 900 }, wide: { w: 1920, h: 1080 }, huge: { w: 2560, h: 1440 } };
const GROUPS = {
  // group: [quick tasks, extra tasks run only with --full]; every task is [label, async fn]
  index: [[['index 1440x900', () => indexChecks(VP.desk)], ['index 390x844', () => indexChecks(VP.phone)]],
          [['index 768x1024', () => indexChecks(VP.tablet)], ['index 1280x720', () => indexChecks(VP.laptop)], ['index 1920x1080', () => indexChecks(VP.wide)]]],
  pages: [[], [...['myapproach', 'adatvedelem', 'whatsappcontact'].flatMap(pg => [[`${pg} 1440`, () => otherPage(pg, VP.desk)], [`${pg} 390`, () => otherPage(pg, VP.phone)]])]],
  touch: [[['touch cursor', touchCursorOff], ['touch tap Értékek', touchTapWhy]], []],
  hover: [[['hover desktop 1440', () => hoverChecks(VP.desk, false)]],
          [['hover desktop 1920', () => hoverChecks(VP.wide, false)], ['hover touch-laptop 1440', () => hoverChecks(VP.desk, true)]]],
  layout: [[['layout 1440x900', () => layoutChecks(VP.desk)]], [['layout 1280x720', () => layoutChecks(VP.laptop)]]],
  header: [[['mobile header', mobileHeader]], []],
  headingfx: [[['headingFx 1440 mouse', () => headingFx(VP.desk, true)], ['headingFx 390 touch', () => headingFx(VP.phone, false)]], []],
  titles: [[['titles 1440x900', () => titleSystem(VP.desk)], ['titles 390x844', () => titleSystem(VP.phone)]],
           [['titles 768x1024', () => titleSystem(VP.tablet)], ['titles 1280x720', () => titleSystem(VP.laptop)], ['titles 1920x1080', () => titleSystem(VP.wide)], ['titles 2560x1440', () => titleSystem(VP.huge)]]],
  about: [[['about 1440x900', () => aboutChecks(VP.desk, 640)], ['about 390x844', () => aboutChecks(VP.phone, 0)]], [['about 1920x1080', () => aboutChecks(VP.wide, 570)]]],
};
const unknown = ONLY.filter(g => !GROUPS[g]);
if (unknown.length) { console.error(`Unknown group(s): ${unknown.join(', ')}. Groups: ${Object.keys(GROUPS).join(', ')}`); await browser.close(); server.close(); process.exit(2); }
const tasks = [];
for (const [g, [quick, extra]] of Object.entries(GROUPS)) { if (ONLY.length && !ONLY.includes(g)) continue; tasks.push(...quick, ...(FULL ? extra : [])); }

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
console.log(`\n${results.length - fails}/${results.length} passed${fails ? `, ${fails} FAILED` : ''}   [${FULL ? 'full' : 'quick'}${ONLY.length ? ' --only=' + ONLY.join(',') : ''}, ${tasks.length} tasks, ${CONCURRENCY} parallel]`);
if (process.env.SMOKE_VERBOSE || fails) console.log('slowest tasks: ' + timings.sort((a, b) => b[1] - a[1]).slice(0, 5).map(t => `${t[0]} ${(t[1] / 1000).toFixed(0)}s`).join(', '));
console.log(`Total duration: ${((Date.now() - T0) / 1000).toFixed(1)}s`);
process.exit(fails ? 1 : 0);
