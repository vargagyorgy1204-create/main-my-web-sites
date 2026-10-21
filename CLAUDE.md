# VarBro site — standing rules for changes

Static HTML/CSS/JS on GitHub Pages (no build step). Pages: `index.html`, `myapproach.html`, `adatvedelem.html`, `whatsappcontact.html`.

1. **Smoke test before every commit.** Run `node tests/smoke.mjs --quick` (default, ~2–3 min: the quick viewport set below, index only). Run `--full` (the whole standard viewport set, all pages, touch-laptop emulation; ~5–7 min) only for site-wide layout / token changes or when asked. **Never run the full suite twice in one task.** Run each test once: no "before" run unless it is a regression hunt; if a check fails, fix it and re-run only that group (`--only=<group>`, groups: index, pages, touch, hover, layout, header, headingfx, whypin, titles, about; add `--full` for its extra viewports), then one final `--quick`. Never commit with failures.
   (Needs Playwright with Chromium. If Playwright is not resolvable set `PW_MODULE=/path/to/playwright`; if Chromium is elsewhere set `PW_CHROMIUM=/path/to/chromium`; `/opt/pw-browsers/chromium` is picked up automatically. The run prints its total duration.)
2. **Change only what the task asks.** Do not refactor or rename shared classes, selectors or ids, and do not touch other sections' CSS/JS. If a shared rule must change, list every section that uses it and re-verify each one.
3. **Hover effects are gated by `html.has-cursor`** (set by `cursor.js` on the first real mouse move), never by `@media (hover: hover) and (pointer: fine)` — touch-screen laptops report those as false. Touch devices use tap / in-view behaviour without hover.
4. **After every change** bump the `?v=` cache-bust versions of every changed asset in ALL html files, then commit, push, and report (the report is written in Ukrainian; site copy stays Hungarian, Ön-form).
5. Do not call `ScrollTrigger.refresh()` manually (it cancels in-flight Lenis anchor scrolls). Do not commit the untracked `photo1–4.jpg` in the repo root.
6. Global rules from `~/.claude/CLAUDE.md` still apply (Lucide icons via CDN, static HTML default).

## Viewports (tests/smoke.mjs)

- **Standard set (`--full`):** phones 360x800, 390x844, 430x932; tablet 768x1024; laptops 1280x720, 1366x768, 1536x864; desktop 1440x900, 1920x1080; **the owner's real Chrome viewport 1518x670** (a 1920x1080 screen at Windows display scaling 125%: CSS px, not the 1897x840 you would measure at 100%). 2560x1440 only for the `titles` group.
- **Quick set (`--quick`, before every commit):** 390x844, 1366x768, 1440x900, 1518x670.
- **Rules:** every layout / proportion change is verified on the **quick set**; changes to shared tokens or to the layout of several sections are verified on the **full set**. Heights below ~700px (1518x670 is the owner's) are the tightest case: check them first for anything that must fit one viewport.
- **Reporting:** the run prints a per-viewport table (checks / failed); copy it into the report (in Ukrainian) so the owner can see which viewport fails.
