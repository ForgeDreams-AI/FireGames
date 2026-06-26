# Core Seven — Data Files (edit these, never the code)

Everything a recruit reads — every graded step, time limit, badge name, hint,
teaching note, map position, and NPC — lives in this folder as JSON. **You can
change the entire game by editing these files. You never touch the `.js` code.**

Four files:

| File | What it controls |
|------|------------------|
| `events.json` | The 7 skills: the official graded steps (the answer key), hints, how-to teaching text, time limits, badge names. |
| `map.json` | The overworld: roads, fences, the HUB, the 7 gym pads, NPCs, and where everything sits. |
| `config.json` | Global settings: pass threshold (0.65), theme, app name, HP, option count. |
| `wildNPCs.json` | Behavior of the roaming quiz recruits (questions are pulled live from `events.json`). |

> ⚠️ JSON rules: every string in `"double quotes"`, commas between items but
> **no comma after the last item**, no `//` comments. After editing, paste the
> file into <https://jsonlint.com> to confirm it's valid before publishing.

---

## events.json — the answer-key spine

```jsonc
{
  "events": [
    {
      "id": "scba",                 // unique key (no spaces). Linked from map.json.
      "name": "SCBA",               // shown in menus
      "badgeName": "SCBA Badge",    // shown in the badge case
      "standardRef": "M.P. 1012.05",// the manual reference
      "timeLimitSeconds": 35,       // graded countdown (whole evolution)
      "variants": ["default"],      // side variants, or just ["default"]
      "sharedSteps": [ ... ],       // steps every variant does
      "variantSteps": {             // OPTIONAL — only for events with sides
        "captain_side": [ ... ],
        "engineer_side": [ ... ]
      },
      "commonTail": [ ... ]         // OPTIONAL — steps after the sides rejoin
    }
  ]
}
```

The engine plays the steps in this order: **sharedSteps → variantSteps[chosen
side] → commonTail**.

### A single step

```jsonc
{
  "order": 1,                       // display number within its list
  "type": "ordered",                // "ordered" | "choice" | "inspection"
  "step": "Turn the cylinder valve on fully...",   // REQUIRED — the graded action
  "critical": true,                 // true = a miss in a GRADED run instantly fails
  "hint": "Valve fully open, listen for the bell.",// one-line cue (may be "")
  "howto": { "default": "" },       // teaching text (may be "" — see below)
  "options": ["correct answer", "wrong 1", "wrong 2"]  // only for choice/inspection
}
```

**The three `type`s:**

- `ordered` — the core mechanic. The recruit picks the correct **next** step.
  Do **not** add an `options` list; the engine builds the choices from the
  other steps automatically.
- `choice` — a knowledge question (a callout, which hand, a setup fact).
  **Add an `options` list and put the CORRECT answer FIRST.** The engine
  shuffles them on screen.
- `inspection` — a final readiness check (e.g. "all PPE on, no skin exposed").
  Same rule: **`options` list, correct answer FIRST.**

**`critical`:** set `true` only on genuine safety/pass-fail steps. In a graded
RTO run a wrong answer here is an instant fail (just like a real evaluation). In
study mode it only shows a warning.

### Filling in empty `howto` / `hint` later (no code changes)

Many `howto` fields are intentionally empty (`""`) — the SME hasn't written the
teaching text yet. The game still works: the study NPC simply says *"Content
coming soon — drill the steps to master it."* To add teaching text later, just
type it into the `"default"` string:

```jsonc
"howto": { "default": "Crack the valve fully so the bell rings — that proves you have air before you trust the mask." }
```

For an event with sides, you can give a side its own teaching text:

```jsonc
"howto": {
  "default": "...",
  "captain_side": "On the captain side you guide the hose around the right shoulder...",
  "engineer_side": "On the engineer side you do-si-do the supply line..."
}
```

Leaving any field empty is always safe.

---

## map.json — the campus

- `grid` is a 2-D array of tile codes. Legend is in `_legend.tiles`:
  `0` ground, `1` road, `2` fence, `3` building wall, `4` pad floor, `5` pad wall.
  `walkable` lists which codes the recruit can stand on.
- `gyms[]` — each pad. **To reassign which pad is which skill, change only that
  gym's `eventId`** (it must match an `id` in `events.json`). `unlockIndex` sets
  the order pads unlock (a pad unlocks when the previous one's badge is earned).
- `hub` — the central academy building (heal/menu/badge-case point).
- `npcs[]` — study instructors. `eventId` ties their teaching to an event.
- `wildNPCs[]` — roaming quiz recruits and the tiles they patrol between.

`tileSize` (32) is the pixel size of one tile. `playerStart` is the recruit's
spawn tile.

---

## config.json

```jsonc
{
  "passThreshold": 0.65,      // 65% academy weekly standard for a graded pass
  "theme": "forgedreams",     // "forgedreams" or "neutral" (greybox)
  "appName": "Core Seven",
  "studyTimedUsesRealLimit": true,   // study "timed" mode uses the real limit
  "settings": { "startingHP": 5, "optionCount": 4, ... },
  "themes": { "forgedreams": { ...colors, fonts... }, "neutral": { ... } }
}
```

Change `theme` to flip all colors/fonts. Colors live under `themes` so even the
look is data, not code.

---

## wildNPCs.json

Holds only **behavior** (how often they move, how many options, the prompt
wording). **No questions are stored here** — they are pulled live from
`events.json`, limited to events the recruit has already entered, so they never
go stale.
