# The Little Fortune Shop

A tiny watercolor tea shop on a rainy evening. Touch the jar, follow the paper
fortune as it floats out, crack open the cookie and unfold the little message
meant for you. Two free fortunes, unlimited for members.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ (relative paths, host anywhere)
npm run lint
```

## How it fits together

| Path | What lives there |
| --- | --- |
| `src/App.jsx` | Wires the shop, the ritual, panels and whispers together |
| `src/components/ShopScene.jsx` | The painted stage: background, rain, lantern glow, counter props, jar, hotspots |
| `src/components/FortuneRitual.jsx` | Jar → floating scroll → cookie → crack → unfolding paper sequence |
| `src/components/FortunePaper.jsx` | Paper styles by rarity (gold leaf, hanko seal, pressed-flower stamp) |
| `src/components/Hud.jsx` | Title, category tags on a cord, lantern (About), hanging account plaque, journal book, sound icons |
| `src/components/Panels.jsx` | Fortune Journal (two-page, filters, search, pages), Sign up / Log in / Account, About, Sound |
| `src/components/Atmosphere.jsx` | Rain on the window, lantern flicker, steam, falling petals |
| `src/hooks/useFortuneShop.js` | Per-account journal, free-fortune count, pending cookie, sound settings |
| `src/hooks/useAuth.js`, `src/lib/auth.js` | Accounts (swap `auth.js` for a real backend) |
| `src/hooks/useStageLayout.js` | Scales the 1412×928 painting to any screen (taller phones get a blurred backdrop) |
| `src/lib/audio.js` | All sound is synthesized with Web Audio — created only after the first touch |
| `src/data/fortunes.js`, `src/data/fortuneGrammar.js` | 160 signature fortunes + phrase banks for ~55,000 more |
| `public/assets/` | Illustrations cut from the watercolor asset sheet (`scene/`, `objects/`, `cookies/`, `paper/`, `tags/`, `ui/`, `decor/`, `textures/`) |

## How the shop works

- **Fortunes:** about 55,000 in all (6,700 to 8,400 per category). Each is built from
  hand-written phrase banks in `src/data/fortuneGrammar.js`, plus 160 hand-written
  signature fortunes in `src/data/fortunes.js`. Rare and Very Rare are always the
  hand-written ones. A fortune's id records which phrases it uses, so the journal
  stores ids only.
- **Rarity mix:** Common 60 · Uncommon 26 · Rare 11 · Very Rare 3. Recently seen fortunes are avoided.
- **Guests vs members:** guests open `FREE_FORTUNES` (2, in `src/config.js`), then are
  asked to sign up. Members open unlimited fortunes. Signing up carries the guest's
  journal into the new account. An unopened cookie survives a refresh.
- **Accounts:** `src/lib/auth.js` is the only file that knows where accounts live.
  Today they are stored in the browser (PBKDF2-hashed passwords). To move to real
  server accounts, replace the four functions there (signUp / logIn / logOut /
  currentUser) with calls to Supabase, Firebase or your own API.
- **Storage:** everything is in `localStorage` under the `little-fortune-shop:` prefix,
  with journals namespaced per account (`user:<id>:…`) or `guest:…`.

## Tests

```bash
npm run build && npx vite preview --port 4173 &
python3 tools/flow_test.py desktop   # or phone / tablet / short (needs Python + Playwright + Chrome)
```

Asset cut-outs were produced with `tools/extract_assets.py` from the original sheet.

## In the dailyfortunecookies.com repo

This app lives in `tea-shop/` (source) and builds into `/shop` at the repo root, so
GitHub Pages serves it at `https://www.dailyfortunecookies.com/shop/` while the
original site at `/` is untouched.

```bash
cd tea-shop
npm install
npm run dev      # work on it locally
npm run build    # rebuilds ../shop — commit that folder to publish
```
