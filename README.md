# CORE SEVEN

A top-down, Pokémon-style training game for **Phoenix Regional Training Academy
(PRTA)** firefighter recruits. A recruit walks a fire-ground overworld, enters
training "gyms" (one per Core Seven skill), learns procedures from instructor
NPCs, then faces the **RTO Evaluator** in a turn-based "battle" where they must
recall the official graded steps — **in order, under time, with safety-critical
mistakes ending the attempt.** Beating the RTO earns that skill's badge. Collect
all 7 badges = cleared for the live fire-ground test.

> **This is a study tool disguised as a game.** The fun wrapper serves recall
> and retention. The procedures come from the real PRTA performance standards
> and are the sacred part — accuracy first.

The Core Seven skills (gyms): **SCBA · Quick Attack — Plug · Quick Attack —
Nozzle · Horizontal Standpipe Front Seat · Horizontal Standpipe Nozzle · Roof
Ops Probe · Roof Ops Cut.**

---

## Run it locally

It's a plain static site — no build step. You just need any static file server
(ES modules don't load from `file://`).

```bash
# from the repo root, pick one:
python3 -m http.server 8080
# or
npx serve .
```

Then open <http://localhost:8080>. Controls work three ways, anywhere:
- **Touch / trackpad / mouse:** the on-screen **D-pad** + **A** button, **or
  tap/click a tile to walk there** (tap an NPC or the RTO to walk up and interact).
- **Keyboard:** **arrow keys** to move, **Enter/Space** for the A button.

The **MENU** button (or walking into the HUB) opens the badge case, reference
library, and settings. On a laptop you can freely mix arrow keys with trackpad
clicks.

### How to play
1. Walk to a **gym pad** (gold door) and step on the door.
2. Talk to the **instructor NPC** to learn the steps (how-to + hints), or open
   **Study / Drill** to climb the ramp: **Recognition → Ordering → Free Recall →
   Timed**.
3. When ready, take the **RTO Evaluator** graded run. Pass (≥65%, survive the
   time limit, no critical miss) to earn the **badge**.
4. **Wild recruits** roam the roads and quiz you on skills you've already
   studied — that's the spaced-repetition layer.

---

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**,
   pick your branch and `/ (root)`.
3. Wait for the green check. Your site is at
   `https://<user>.github.io/<repo>/`.

Everything uses **relative paths** (`./...`), so it works from a project
subpath, a user/org root, or a custom domain with **zero code changes**. There
are **no custom server headers** required (no COOP/COEP) and **no backend** —
just static files.

### Custom domain (CNAME) later
1. Add a file named `CNAME` at the repo root containing your domain, e.g.
   `coreseven.prta.example`.
2. Point your DNS (a CNAME record) at `<user>.github.io`.
3. **Settings → Pages → Custom domain** → enter the domain, enable HTTPS.

No code edits needed — relative paths handle the swap.

### Generate a QR code for recruits
Recruits scan a link to launch/install. Generate a QR pointing at your Pages
URL (or custom domain):

```bash
npx qrcode "https://<user>.github.io/<repo>/" -o coreseven-qr.png
```

Or paste the URL into any QR generator (e.g. qr-code-generator sites). Print it
on the recruit handout — scanning opens the game, and from the browser menu they
can **"Add to Home Screen."**

---

## Install as an app (PWA, works offline)

Core Seven is a Progressive Web App:
- **iOS Safari:** Share → **Add to Home Screen**.
- **Android Chrome:** menu → **Install app / Add to Home screen**.

Once installed it runs **fully offline** — a service worker
(`service-worker.js`) precaches the game, data, and engine. No network calls, no
accounts, no analytics. Progress (badges + settings) is stored in the browser's
`localStorage` on that device.

> If you change any file, bump the `CACHE` version string in
> `service-worker.js` (e.g. `coreseven-v1` → `coreseven-v2`) so installed
> devices pick up the update.

---

## Editing content (no coding)

**All content lives in `/src/data/*.json`.** Adding a cohort, changing a
sequence, fixing a step, reassigning a pad, filling in teaching text — all are
**JSON edits only**. See **[`src/data/README.md`](src/data/README.md)** for the
full schema written for non-coders. Highlights:

- **Fix or add a graded step:** edit `events.json`. `ordered` steps need no
  options; `choice`/`inspection` steps list options with the **correct answer
  first**.
- **Fill empty `howto`/`hint`:** type text into the `""` fields in
  `events.json`. Empty is always safe — the NPC shows a friendly "coming soon"
  message and the gym still works.
- **Reassign which pad is which skill:** change a gym's `eventId` in `map.json`.
- **Change the pass threshold / theme / app name:** edit `config.json`.

### Studio — a visual editor for events, steps & criticals (no JSON by hand)

Open **`studio.html`** (e.g. `http://localhost:8080/studio.html`, or
`https://<your-site>/studio.html`) for a form-based editor of the procedures —
no code or JSON editing:

- Loads the live `events.json`; pick any event on the left.
- Edit event fields (name, badge, standard ref, **time limit**, RTO intro lines)
  and every step: **type** (ordered / choice / inspection), the **step text**,
  the **⚠ Critical (instant-fail)** flag, hint, how-to, and — for choice/
  inspection — the answer **options** (first = correct). Add / remove / reorder
  steps; add or delete events; handles side variants + the common tail.
- **▶ Apply locally (preview):** see your edits in the game immediately **on this
  device** (stored in the browser; doesn't affect anyone else). **⊘ Clear local
  preview** reverts to the published file.
- **⬇ Export events.json** (or **⧉ Copy JSON**): download the updated file. To
  **publish for everyone**, that file replaces `src/data/events.json` in the repo
  and is deployed (commit it, or hand it to whoever manages the site). Static
  hosting has no server, so the editor can't auto-publish — export → commit.

---

## Swapping greybox art for real art

The game now ships with **real pixel art** for the map tiles, the recruit, NPCs,
the RTO, and the fire engine (Kenney CC0 — see *Art credits* below); any key
without bundled art still falls back to **greybox** generated at runtime, so the
game always renders. Every tile and sprite is declared in
**`/src/assets/manifest.json`** by a key. While a key's `"file"` is empty, the
engine draws a themed greybox box. **To drop in real art with no code changes:**

1. Put your PNG in `/src/assets/` (e.g. `src/assets/player.png`).
2. Set its path in the manifest: `"player": { "file": "player.png", ... }`.
3. Reload. The real image replaces the greybox automatically. (If a file is
   missing it safely falls back to greybox.)

Images of **any pixel size** drop in — the engine scales them to fit (tiles to
the 32px cell, sprites to their manifest `w`/`h` box, aspect preserved), so you
don't have to pre-resize. **Use only original or openly-licensed (e.g. CC0)
art** — do not copy any existing game's sprites, fonts, or sounds.

### Art credits

Bundled art:

- **Kenney — Pico-8 City** (CC0): map/interior tiles (ground, road, walls,
  concrete).
- **Kenney — Pixel Vehicle Pack** (CC0): the fire engine + the signage post.
- **First Responders pack** (project-supplied): the firefighter recruit,
  instructors, RTO, the paramedic wild-NPCs, and the gym tool props (axe, vent
  saw, hydrant wrench, nozzle). ⚠️ This pack arrived **without a license file** —
  confirm its usage rights with the original source before public distribution.

The Kenney packs are CC0 (no attribution required; credited as good practice).
Full notes are in `src/assets/CREDITS-*.txt`. Replace or extend any art via the
manifest or the in-app **Settings → Graphics → Replace art**.

### Theme / chrome

The UI chrome has two themes read from `config.json`: **`forgedreams`** (navy
`#14213D`, gold `#FFC72C`, sage + cream; Cormorant Garamond + DM Sans) and a
**`neutral`** greybox theme. Switch in-game under **Settings → Graphics**, or set
the default via `config.json → "theme"`. Web fonts load with safe system
fallbacks (so it still looks right offline).

### In-game graphics customization (Settings → Graphics)

No coding needed — every option saves to this device's `localStorage`:

- **Theme** — switch ForgeDreams / Greybox.
- **Colors** — a color picker for every palette color; changes apply live to the
  UI and the map. "Reset colors" restores the theme defaults.
- **Replace art** — upload your own image for any sprite/tile key (player, RTO,
  NPC, props, ground, walls…). Stored on the device and used instead of greybox,
  no file editing. "Reset" per item or "Reset all art" reverts.
- **Display** — map **zoom**, **text size**, **reduced motion** (skips
  transitions/animations), **force greybox** (ignore all art, draw greybox), and
  a **fullscreen** toggle.

This complements the file-based swap layer above: designers can drop real PNGs
into `src/assets/` + the manifest for a permanent swap, while
recruits/instructors can also override art and colors per device from inside the
app.

## Gym interiors

Each gym is a real **interior room** the recruit enters (not just a pad). Walking
onto a gym door fades into a themed interior with study NPC(s), the RTO at the
back, props, an exit door, and a **signage board** (gym name, badge status, time
limit, 65% threshold). A study NPC runs a **guided walk-through** of the event
step-by-step (Next, critical-step flags, graceful empty `howto`/`hint`;
side-variant events pick the side first). Approaching the **RTO** plays an
encounter intro + **Drill / Graded** prompt, then the battle. Every interior —
its tile map and NPC/RTO/prop/exit/signage placements — lives in `map.json` under
each gym's `interior` object, and the RTO's lines live in `events.json`
(`rtoIntro` / `rtoModePrompt`). Move or retheme anything by editing JSON only.

---

## Reset progress (shared devices)

**MENU → Settings → Reset all progress** wipes badges + settings from this
device's `localStorage`. Useful when recruits share a tablet.

---

## Project layout

```
index.html              entry point (loads Phaser + the ES-module app)
manifest.webmanifest    PWA manifest
service-worker.js       offline precache
vendor/phaser.min.js    Phaser 3 (vendored locally for offline)
src/
  main.js               bootstrap + on-screen controls + SW registration
  engine/               content-free logic
    DataLoader.js  EventModel.js  BattleEngine.js  Storage.js  Theme.js
  scenes/               Phaser scenes (overworld + boot/art loader)
    BootScene.js  OverworldScene.js
  ui/                   DOM overlay layer (dialogue, battle, menus) + styles.css
  data/                 ← ALL CONTENT (events, map, config, wildNPCs) + schema docs
  assets/               art manifest, greybox swap layer, PWA icons
```

**Design rule (enforced):** no content string — no step, time, badge, NPC line,
or coordinate — is hard-coded in any engine/scene `.js` file. The engine reads
data and renders whatever is there. If you find content in code, that's a bug.
