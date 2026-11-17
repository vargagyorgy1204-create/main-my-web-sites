# Instagram card (Portfólió, last card)

The card is rendered from `js/instagram-data.js` (`window.IG_DATA`); layout code never needs to change.

## Swap the placeholder posts for the real ones
1. Put the new **square** images into `assets/instagram/` (e.g. `post-a.webp`, 360 px; and a 720 px `post-a@2x.webp`).
2. Replace the paths in the `posts` array of `js/instagram-data.js` (keep a multiple of 3: 9 or 12 look best).
3. Done. (`retina: true` expects an `@2x` file next to every post; set it to `false` if you only have one size.)
4. Delete `assets/instagram/placeholder/` when it is no longer used.

## Other files
- `avatar.webp` – profile picture (160 px, square). Currently a crop of the site photo; replace it any time. If the file is missing the site photo `contact-640.webp` is used.
- `qr.svg` – QR code of `profileUrl` (white modules, 4-module quiet zone). Regenerate it if the profile URL changes (any QR generator, white modules on transparent).
- Bio / name / handle / profile URL: same data file.
