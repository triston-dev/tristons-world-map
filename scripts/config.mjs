// Generalized from tristons-transformations scripts/config.mjs:1 — the MODULE_ID constant
// pattern. Keep this file free of any `game`/`foundry`/`Hooks` reference so it stays trivially
// unit-testable per docs/testing-foundry-logic.md ("pure core").

export const MODULE_ID = "tristons-world-map";

/** The canvas layer key: CONFIG.Canvas.layers[LAYER_NAME] and canvas[LAYER_NAME]. */
export const LAYER_NAME = "tristonsWorldMap";

/** Pin visibility states — see scripts/core/discovery.mjs for the transition rules. */
export const VISIBILITY = {
  GM: "gm",                 // GM-only forever (never auto-revealed)
  HIDDEN: "hidden",         // hidden from players until discovered/revealed
  DISCOVERED: "discovered", // was hidden, now revealed (carries discoveredOn day)
  VISIBLE: "visible"        // always visible to everyone
};

/** Pin type registry: icon (FontAwesome, used in HTML UI) + marker color (canvas). */
export const PIN_TYPES = {
  location: { icon: "fa-solid fa-location-dot", color: 0xd94a3d, labelKey: "TWM.PinTypes.location" },
  city:     { icon: "fa-solid fa-city",         color: 0x4a7bd9, labelKey: "TWM.PinTypes.city" },
  dungeon:  { icon: "fa-solid fa-dungeon",      color: 0x6b4ad9, labelKey: "TWM.PinTypes.dungeon" },
  nature:   { icon: "fa-solid fa-tree",         color: 0x3d9950, labelKey: "TWM.PinTypes.nature" },
  quest:    { icon: "fa-solid fa-scroll",       color: 0xd9a53d, labelKey: "TWM.PinTypes.quest" },
  rumor:    { icon: "fa-solid fa-comment-dots", color: 0x8a8a8a, labelKey: "TWM.PinTypes.rumor" },
  player:   { icon: "fa-solid fa-thumbtack",    color: 0x3dbfd9, labelKey: "TWM.PinTypes.player" }
};

/** What a left-click on a pin does. */
export const PIN_CLICK_ACTIONS = ["none", "journal", "scene", "macro"];

/** Default shape for a new pin — see scripts/core/store.mjs makePin(). */
export const PIN_DEFAULTS = {
  type: "location",
  name: "",
  img: "",
  blurb: "",
  gmNotes: "",
  visibility: VISIBILITY.VISIBLE,
  discoveredOn: null,
  journalUuid: "",
  sceneUuid: "",
  macroUuid: "",
  clickAction: "journal",
  questStatus: null,
  createdBy: null
};

/** Per-scene map configuration defaults (flags.mapConfig). */
export const MAP_CONFIG_DEFAULTS = {
  distancePerGrid: 6,      // map units per grid square
  unitLabel: "miles",      // display only; pace sets carry their own unit label too
  advanceWorldTime: false  // call game.time.advance(1 day) per travel day
};

/** Route statuses. */
export const ROUTE_STATUS = {
  PLANNED: "planned",
  PROPOSED: "proposed",
  ACTIVE: "active",
  DONE: "done"
};

/** Default shape for a new route — see scripts/core/store.mjs makeRoute(). */
export const ROUTE_DEFAULTS = {
  name: "",
  waypoints: [],
  status: ROUTE_STATUS.PLANNED,
  proposedBy: null,
  createdBy: null
};

/** Travel state defaults (flags.travelState). */
export const TRAVEL_DEFAULTS = {
  mode: "marker",          // "marker" | "tokens" (Phase 5)
  marker: null,            // {x,y} party position, null = not placed
  navigatorUserId: null,   // Phase 5
  day: 0,
  paceSetId: "dnd5e-overland",
  paceId: "normal",
  activeRouteId: null,
  segmentIndex: 0,
  progressPx: 0
};

export const config = {
  moduleId: MODULE_ID
};
