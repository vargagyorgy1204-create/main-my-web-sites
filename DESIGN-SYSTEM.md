# VarBro design system — proportional layout

One system, one place: every size on the site is a **fluid token** derived from the reference viewport **1440×900**
(`clamp()` of `vw` / `svh`). The tokens are defined **once**, in the `DESIGN TOKENS` block at the top of `style.css`
(`:root`, plus three small media overrides next to it). Sections only **use** tokens.

## Reference and standard viewports

- **Reference:** 1440×900. Values at 1440×900 never change when a token formula is edited for other screens.
- **Standard set (`node tests/smoke.mjs --full`, and the columns of the review board):**
  360×800, 390×844, 430×932 (phones) · 768×1024 (tablet) · 1280×720, 1366×768, 1536×864 (laptops) · 1440×900, 1920×1080 (desktop) ·
  **1518×670** (the owner's *windowed* Chrome: a 1920×1080 screen at Windows scaling 125%) · 2560×1440 only for the `titles` group.
- **Owner's screens:** windowed Chrome = **1518×670** · fullscreen = **1536×864** (both Windows scaling 125%).
- **Quick set (`--quick`, before every commit):** 390×844, 1366×768, 1440×900, 1518×670.
- Short-wide windows (1518×670, 1366×768) are the tightest case: everything that must fit one viewport is checked there first.

## Tokens

| Token | Formula | 390×844 | 1366×768 | 1440×900 | 1518×670 | 1536×864 | 1920×1080 |
|---|---|---|---|---|---|---|---|
| `--hdr-h` | `92px` (76px < 768px) | 76 | 92 | 92 | 92 | 92 | 92 |
| `--hdr-side` / `--hdr-logo-w` | `32px` / `44px` (header zones) | 32 / 44 | 32 / 44 | 32 / 44 | 32 / 44 | 32 / 44 | 32 / 44 |
| `--content-gutter` | `20px`; ≥ 1024px: `--hdr-side + --hdr-logo-w + 32px` | 20 | 108 | 108 | 108 | 108 | 108 |
| `--content-max` | `clamp(1152px, 78vw, 1480px)` | 1152 | 1152 | 1152 | 1184 | 1198 | 1480 |
| `--section-top` | `--hdr-h + clamp(24px, 4svh, 56px)` (section top → eyebrow) | 109.8 | 122.7 | 128 | 118.8 | 126.5 | 135.2 |
| `--section-bottom` | `clamp(48px, 9svh, 104px)` (last block → section / viewport bottom) | 76 | 69.1 | 81 | 60.3 | 77.8 | 97.2 |
| `--sec-bottom` | `clamp(20px, 3svh, 28px)` (legacy, pinned Együttműködés bottom padding) | 25.3 | 23 | 27 | 20.1 | 25.9 | 28 |
| `--section-top-tight` | `--hdr-h + clamp(8px, 1.6svh, 20px)` (tight anchor, see below) | 90 | 104.3 | 106.4 | 102.7 | 104.3 | 109.3 |
| `--content-gutter-tight` | `20px`; ≥ 1024px: `96px` (= logo right edge 76px + 20px) | 20 | 96 | 96 | 96 | 96 | 96 |
| `--content-max-tight` | `100vw − 2 × --content-gutter-tight` (content spans gutter → gutter, never re-centred) | 350 | 1174 | 1248 | 1326 | 1344 | 1728 |
| `--eyebrow-size` | `clamp(11px, 8px + 0.28vw, 13px)` | 11 | 11.8 | 12 | 12.3 | 12.3 | 13 |
| `--eyebrow-gap` | `clamp(12px, 1.6svh, 20px)` (generic eyebrow → next block) | 13.5 | 12.3 | 14.4 | 12 | 13.8 | 17.3 |
| `--eyebrow-head-gap` | `10px` (eyebrow → heading of the unified sections) | 10 | 10 | 10 | 10 | 10 | 10 |
| `--head-gap` | `clamp(28px, 4svh, 56px)` (heading → first content block) | 33.8 | 30.7 | 36 | 28 | 34.5 | 43.2 |
| `--section-heading-size` | `clamp(18px, min(4.277vw, 6.84svh), 69.12px)`; < 768px: `clamp(22px, (100vw − 40px) / 13.9, 34px)` | 25.2 | 52.5 | 61.5 | 45.8 | 59.1 | 69.1 |
| `--section-heading-lh` | `1.12`; ≥ 900px: `1.06` | 1.12 | 1.06 | 1.06 | 1.06 | 1.06 | 1.06 |
| `--about-heading-size` | `clamp(30px, 8.2vw, 42px)` (Rólam, list layout) | 32 | 42 | 42 | 42 | 42 | 42 |
| `--about-heading-size-pinned` | `clamp(30px, min(4.6vw, 6.6svh), 64px)` (Rólam, pinned story ≥ 900px) | 30 | 50.7 | 59.4 | 44.2 | 57 | 64 |

### Two anchors

- **Wide anchor (default):** `--section-top`, `--content-gutter`, `--content-max`. Used by the hero, Rólam (its eyebrow lives in the text card), the footer and the other pages.
- **Tight anchor — class `.section--tight`** on `#skills`, `#why`, `#steps`, `#services`, `#portfolio`, `#contact`: the class re-points
  `--section-top`, `--content-gutter` and `--content-max` to the `-tight` tokens, so everything inside those sections (eyebrow, heading, lead,
  rows, cards, the pinned stages) starts at the left line (96px at ≥ 1024px, 20px below) and ends at the symmetric right line, and the eyebrow sits
  `hdr + clamp(8px, 1.6svh, 20px)` below the section top. Inner layouts scale with the width (Készségek rows: columns 4.96% | 4.26% | 1fr | 33.7%;
  Értékek cards: `cqw` of the row; Együttműködés: 4 equal columns).
- Együttműködés stage: min-height = `100svh − --section-top − --section-bottom`, the closing CTA row sits at its bottom edge (bottom gap = `--section-bottom`);
  `--fit` (scale) only kicks in if the content does not fit (0.96 at 1518×670, 0.99 at 1280×720, 1 elsewhere). The closing line is allowed 700px (one row on laptops).

The 6 unified headings (`.section-heading`: Készségek, Értékek, Együttműködés, Szolgáltatások, Portfólió, Kapcsolat) all use
`--section-heading-size`; in the scaled sections (`--fit`) it is laid out at `size / fit` so the **rendered** size is always the token.
The Rólam heading keeps its own tokens and is deliberately a different size.

### Body text (not tokens yet — current computed values)

| Text | 390 | 1366×768 | 1440×900 | 1518×670 | 1536×864 | 1920 |
|---|---|---|---|---|---|---|
| Rólam `.abt-body` | 16.8 | 15.4 | 17 | 14 | 17 | 17 |
| Készségek description | 14 | 14 | 14 | 14 | 14 | 15 |
| Szolgáltatások `.svt-sub` | 15 | 14.6 | 17.1 | 14 | 16.4 | 18 |
| Portfólió `.pf__sub` | 15 | 15 | 17.1 | 15 | 16.4 | 18 |
| Kapcsolat `.ctc-sub` | 15 | 15 | 15 | 15 | 15 | 18 |
| Értékek card text | 15 | 14 | 14 | 14 | 14 | 16 |

### Heights of the pinned / fitted sections

| | 390 | 1366×768 | 1440×900 | 1518×670 | 1536×864 | 1920×1080 |
|---|---|---|---|---|---|---|
| Rólam composition (photo card = text card) | list | 614 | 640 | 526 | 640 | 570 |
| Értékek cards row (fills the stage: `100svh − --section-top − heading block − --section-bottom`, min 240px) | stacked | 405 | 430 | 336 | 470 | 627 |
| Együttműködés `--fit` (scale of the stage) | 1 | 1 | 1 | 0.938 | 1 | 1 |

## Rules

1. **No per-section magic numbers.** A section may only use tokens (and `clamp()` of `vw` / `svh` expressed as a token). If a
   section needs a new value, add a token to the `DESIGN TOKENS` block first, then use it.
2. **Anchors.** Every section: eyebrow `--section-top` below the section top, on the corridor line (`--content-gutter` /
   `--content-max`); eyebrow → heading `--eyebrow-head-gap`; heading → content `--head-gap`; content → bottom `--section-bottom`.
   Exception: Rólam, whose eyebrow lives inside the white text card.
3. **Pinned sections fit one viewport** on every standard viewport: the stage is exactly `100svh`, the cards / content take what is
   left, the heading, eyebrow and bottom gap never shrink. Low windows get shorter cards, not smaller headings.
4. **Balanced on short-wide screens** (1518×670, 1366×768) as well as tall ones: check those first.
5. **Equal headings.** All `.section-heading` render at the identical size on a given screen; transforms must not hide a difference
   (the smoke test compares the rendered line height).
6. **Hover** is gated by `html.has-cursor`, never by media queries (see `CLAUDE.md`).
7. Verify layout / proportion changes on the quick set; token and multi-section changes on the full set.

## Hard-coded values that are NOT tokens yet (audit)

Converted with no visual change at 1440×900: the 10px eyebrow → heading gap (`--eyebrow-head-gap`), `--eyebrow-size`, the two Rólam
heading sizes, `--sec-top` (was a duplicate of `--section-top`) and two dead `#contact.ctc` padding rules (overridden later).
Left as they are, because converting them would change the look at 1440×900 or they belong to a different system:

- Legacy section paddings overridden by the anchor system but still defining the *bottom* / side space: `#about { padding: 120px 20px 80px }`,
  `#skills { padding: 90px 20px 100px }` / `120px 24px`, `#steps { padding: 120px 24px }`, `.section { padding: 120px 20px }`, `.ap { padding-bottom: 90px }`.
- Heading → lead gaps: `.svt-intro .section-heading { margin-bottom: 16px }`, `.pf__head .section-heading { clamp(12px, 1.9svh, 20px) }`.
- `.why-head`, `.steps-head`, `.skills-head` margins with px / `svh` values that the anchor system overrides with `--head-gap`
  (dead on large screens, still live in some media queries).
- Body text sizes (table above): they use per-section `clamp(… svh …)` formulas; unifying them would shift line breaks.
- Card internals (padding / radius / icon sizes) of Értékek, Szolgáltatások, Portfólió, footer: component-level, not layout proportions.
- `1152px` / `1280px` max-widths in the footer, `.ctc__head` and the legal pages.

## Kapcsolat form card (`--cf-*` tokens)

| Token | Value | Use |
|---|---|---|
| `--cf-fs` | `16px` (< 1024px, no iOS zoom); `13.5px` (>= 1024px) | text / placeholder of inputs, select, textarea, custom dropdown options; the floating label is `--cf-label-scale` of it |
| `--cf-h` | `43.2px` (< 1024px); `clamp(39.6px, 5.04svh, 43.2px)` (>= 1024px) | input / select / dropdown-trigger height |
| `--cf-ta-h` | `93.6px` | textarea min-height (vertical resize only) |
| `--cf-label-scale` / `--cf-label-top` | `0.666` / `6.3px` (< 1024px); `0.78` / `4.5px` (>= 1024px) | floating label size and distance from the field's top edge |
| `--cf-gap` | `clamp(9px, 1.26svh, 12.6px)` | between fields |
| `--cf-radius` | `12.6px` | field and dropdown-panel radius |
| `--cf-fields-w` | `min(100%, max(85%, 280px))` | width of Név, E-mail, Telefonszám, the dropdown (trigger + panel) and the textarea inside the form card: 85% of the card's inner width, at least 280px on phones; centred, the rest is side margin |
| `--cf-pad-x` | `14.4px` | field inner left / right padding and the label offset |
| `--cf-check` | `19.8px` | consent checkbox |
| `--cf-consent-fs` | `0.792rem` | consent text (12.7px; gap 9px) |
| `--cf-opt-h` | `36px` | custom dropdown option row |
| `--cf-title-gap` | `clamp(24px, 3.4svh, 36px)` | title -> first field |
| `--cf-btn-gap` | `clamp(18px, 2.4svh, 26px)` | consent row -> submit button AND submit button -> confidentiality note (equal) |
| `--cf-bottom-pad` | `clamp(28px, 4svh, 44px)` | confidentiality note -> card bottom (extra height from the equal-height row is split evenly above and below the content) |
| `--cf-title-fs` | `clamp(1.25rem, 2.2svh, 1.5rem)` | form title "Kérjen árajánlatot" (Syne 800, letter-spacing −0.02em, plain white: the type of the photo card tagline) |
| `--cf-tagline-fs` | `clamp(22px, 1.1rem + 0.5vw, 26px)` | photo card tagline "Dizájn, kód és mozgás" (on phones capped at `(100vw - 84px) / 17` so the line never wraps) |
| `--cf-note-fs` | `0.875rem` | "Adatait bizalmasan kezelem." and "Általában 24 órán belül válaszolok." (shared, same colour) |
| `--cf-photo-d` | `clamp(190px, 27svh, 260px)` (< 1024px); `clamp(150px, 19.5svh, 186px)` (>= 1024px, so the photo card is never taller than the form card) | photo card: portrait diameter |
| `--cf-pc-btn-gap` | `clamp(24px, 3.4svh, 36px)` | photo card: minimum gap above the WhatsApp button and below the e-mail button; the free height is split equally between the two gaps (the note stays at the card bottom) |

## Footer: divider line + back-to-top badge

| Token | Value | Use |
|---|---|---|
| `--footer-pad-y` | `clamp(33px, calc(5.5svh - 3px), 57px)` | footer top edge -> column headings, and bottom of the tallest column -> divider line (the two gaps are equal) |
| `--footer-divider-bottom` | `clamp(24px, 4svh, 48px)` | divider line -> VARBRO wordmark top |
| `--footer-stamp-d` | `clamp(70px, 9.3svh, 100px)` (76px < 1024px) | back-to-top badge diameter (the hero badge size), centred on the right end of the divider |

The footer columns: description + the four social icons (24px below the text), Navigáció (5 items), Elérhetőség. The old bottom row and the "Vissza a tetejére" pill are gone; the legal row and the wordmark are unchanged.

## Footer typography tokens

| Token | Value | Use |
|---|---|---|
| `--footer-desc-fs` | `16px` (line-height 1.6) | footer description, first column |
| `--footer-link-fs` / `--footer-link-lh` | `15.2px` / `1.75` (26.6px) | Navigáció links and the Elérhetőség rows (same type, rows level with each other) |
| `--footer-row-gap` | `clamp(6px, 0.93svh, 10px)` | row gap at the old 25.6px row height; the real margin is this minus `--footer-row-shrink` (= 26.6px - 25.6px), so the row step is unchanged |
