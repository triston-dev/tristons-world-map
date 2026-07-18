<!-- Module-README skeleton, assembled per docs/module-anatomy.md and docs/release-and-deploy.md,
     structure modeled on tristons-transformations README.md:1-45 (Grim Hollow/Tooling/tristons-transformations/README.md)
     — title, Requirements, Installation, Usage, (Content attribution if applicable) sections. -->

# Triston's World Map

Turn any scene into a living world map: pins with discovery states, travel paths and history trails, party tracking, region-based random encounters, automated party-wide perception checks, weather, supplies, and an auto-generated travel chronicle.

## Requirements

- Foundry VTT **v13** (verified on 13.351)
- The **dnd5e** system, **v5.2 or later** (verified on 5.3.3)

## Installation

In Foundry's **Setup → Add-on Modules → Install Module**, paste this manifest URL and install:

```
https://github.com/triston-dev/tristons-world-map/releases/latest/download/module.json
```

Alternatively, download a release zip from the
[releases page](https://github.com/triston-dev/tristons-world-map/releases) and extract it into
`Data/modules/tristons-world-map/`.

## Usage

### Getting started (GM)

1. Open any scene you want to use as an overland/world map.
2. Click the **World Map** scene-control group (map-pin icon on the left toolbar) and hit
   **Toggle World Map for this Scene**.
3. Open the **World Map Control** panel (toolbar button, `Ctrl+Shift+M`, or the module's
   settings-menu entry) and set your map scale on the **Settings** tab (distance per grid
   square + unit label — miles, parsecs, whatever your game uses).

### Pins

- **Place Pin** tool: click the map to drop a pin. Pins have a type (location, settlement,
  dungeon, quest, rumor, …), an image, a blurb, GM-only notes, and a visibility state:
  *Always Visible*, *Hidden (undiscovered)*, *Discovered*, or *GM Only*.
- Hovering a pin shows a rich tooltip card; clicking runs its configured action — open a
  journal, jump to a linked scene, or fire a macro. Right-click (GM) edits the pin.
- Hidden pins can be revealed manually from the panel's **Pins** tab, or automatically by
  perception triggers (below). GM-only pins are never revealed to players.

### Travel

- **Draw Route** tool: left-click waypoints, right-click to finish. Activate a route on the
  **Travel** tab, pick a pace (pace sets are fully editable on the **Paces** tab — ship your
  own sw5e parsecs/day set), and hit **Travel 1 day** / **Travel N days**.
- The party marker walks the route one day at a time, leaving a permanent history trail.
  Remaining distance and ETA are shown live. Optionally advance the world clock per day.

### Encounters & perception (native Regions)

Draw a native Scene **Region** over an area and add this module's behaviors from the
region's config sheet:

- **Encounter Zone (World Map)** — link a RollTable + chance per travel day (and an optional
  terrain speed multiplier). Traveling through rolls encounters and prompts the GM to fire
  or skip; fired results post to chat.
- **Perception Trigger (World Map)** — set a DC, passive or active mode, and optionally link
  a hidden pin's id. When the party travels through, the whole party is checked; the GM gets
  a whispered breakdown and successes reveal the linked pin.

### Players

Players see discovered pins, the trail, planned routes, and the party marker. They get their
own tools: **Drop a Party Mark** (capped, party-visible pins) and **Propose Route** (lands on
the GM's Travel tab for approval). The GM can designate a **navigator** player who may move
the party marker. All player actions route through the GM's client — no player ever writes
scene data directly.

### Extras

- **Weather** (Settings tab): daily rolls from a built-in table or your own RollTable —
  tag results like `Storm [x0.6]` to slow travel.
- **Supplies** (Travel tab): rations per member per day with low/empty warnings (set −1 to
  disable).
- **Quests** tab: quest/rumor pins with rumored → active → completed statuses.
- **Travel Chronicle** (Settings tab): an auto-written journal logging each day's distance,
  weather, encounters, and discoveries — session-recap gold.

## Development

- `npm install` — installs `@foundryvtt/foundryvtt-cli` (only devDependency).
- `npm test` — runs `node --test` over `tools/tests/**/*.test.mjs`.
- `npm run release` — builds `release/tristons-world-map-<version>.zip` via `tools/release.mjs`.

See this module's own `CLAUDE.md` for house working rules, and the Foundry Module Master repo's
`docs/` playbooks for the conventions this scaffold follows.
