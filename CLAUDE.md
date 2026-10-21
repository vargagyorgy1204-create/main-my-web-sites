# VarBro site — standing rules for changes

Static HTML/CSS/JS on GitHub Pages (no build step). Pages: `index.html`, `myapproach.html`, `adatvedelem.html`, `whatsappcontact.html`.

1. **Smoke test before every commit.** Run `node tests/smoke.mjs --quick` (default, ~1–1.5 min: 1440x900 + 390x844, index only). Run `--full` (all viewports, all pages, touch-laptop emulation; ~4 min) only for site-wide layout / token changes or when asked. **Never run the full suite twice in one task.** Run each test once: no "before" run unless it is a regression hunt; if a check fails, fix it and re-run only that group (`--only=<group>`, groups: index, pages, touch, hover, layout, header, headingfx, whypin, titles, about; add `--full` for its extra viewports), then one final `--quick`. Never commit with failures.
   (Needs Playwright with Chromium. If Playwright is not resolvable set `PW_MODULE=/path/to/playwright`; if Chromium is elsewhere set `PW_CHROMIUM=/path/to/chromium`; `/opt/pw-browsers/chromium` is picked up automatically. The run prints its total duration.)
2. **Change only what the task asks.** Do not refactor or rename shared classes, selectors or ids, and do not touch other sections' CSS/JS. If a shared rule must change, list every section that uses it and re-verify each one.
3. **Hover effects are gated by `html.has-cursor`** (set by `cursor.js` on the first real mouse move), never by `@media (hover: hover) and (pointer: fine)` — touch-screen laptops report those as false. Touch devices use tap / in-view behaviour without hover.
4. **After every change** bump the `?v=` cache-bust versions of every changed asset in ALL html files, then commit, push, and report (the report is written in Ukrainian; site copy stays Hungarian, Ön-form).
5. Do not call `ScrollTrigger.refresh()` manually (it cancels in-flight Lenis anchor scrolls). Do not commit the untracked `photo1–4.jpg` in the repo root.
6. Global rules from `~/.claude/CLAUDE.md` still apply (Lucide icons via CDN, static HTML default).
