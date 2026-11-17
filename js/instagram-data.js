/* ==========================================================================
   instagram-data.js — the ONLY place the Portfólió Instagram card gets its content from.

   js/portfolio.js renders the last card (the phone mockup) from window.IG_DATA.
   To swap the placeholder posts for the real ones: drop the new square images
   into assets/instagram/ (see assets/instagram/README.md), list their paths in
   `posts` below — nothing else has to change.

   handle / profileUrl  the profile (card title, button, QR code, click on the phone)
   name, bio            shown on the phone's profile screen
   avatar               square image; if it fails to load, `avatarFallback` is used
   posts                image paths, shown as a 3-column grid. A multiple of 3 gives
                        full rows (a remainder is dropped, so the loop stays seamless).
   retina               true = every post also has a "<name>@2x.<ext>" file (2x pixels)
   qr                   the QR code of profileUrl (white modules, quiet zone included)
   ========================================================================== */
window.IG_DATA = {
  handle: 'webdeveloper_varbro',
  profileUrl: 'https://www.instagram.com/webdeveloper_varbro/',
  name: 'Varga György',
  bio: ['Weboldalak kisvállalkozásoknak', 'Dizájn, kód és mozgás', 'varbro.pro'],
  avatar: 'assets/instagram/avatar.webp',
  avatarFallback: 'contact-640.webp',
  qr: 'assets/instagram/qr.svg',
  retina: true,
  /* PLACEHOLDERS: crops of the portfolio screenshots (assets/instagram/placeholder/) */
  posts: [
    'assets/instagram/placeholder/post-01.webp',
    'assets/instagram/placeholder/post-02.webp',
    'assets/instagram/placeholder/post-03.webp',
    'assets/instagram/placeholder/post-04.webp',
    'assets/instagram/placeholder/post-05.webp',
    'assets/instagram/placeholder/post-06.webp',
    'assets/instagram/placeholder/post-07.webp',
    'assets/instagram/placeholder/post-08.webp',
    'assets/instagram/placeholder/post-09.webp',
    'assets/instagram/placeholder/post-10.webp',
    'assets/instagram/placeholder/post-11.webp',
    'assets/instagram/placeholder/post-12.webp'
  ]
};
