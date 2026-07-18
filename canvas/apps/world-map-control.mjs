// Generalized from tristons-loot-generator (Triston's Loot Generator/) — a minimal working
// ApplicationV2 window, converted .js -> .mjs per this project's plain-ESM house stack
// (CLAUDE.md #2; both shipped exemplars are plain ESM, loot-gen just happens to use a bare
// `.js` extension for its own app files rather than `.mjs`).
//
// - `HandlebarsApplicationMixin`/`ApplicationV2` destructure: scripts/apps/table-manager.js:26
//   (`const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;`).
// - `static DEFAULT_OPTIONS` (id/window/position/actions) + `static PARTS`:
//   scripts/apps/table-manager.js:46-69 (TableManagerApp; see docs/application-v2-apps.md
//   "Worked example" for the annotated version of this exact snippet).
// - Instance-tracking + close() override: scripts/apps/history.js:89-127 (HistoryApp) — the
//   TRUE SINGLETON pattern (one window per client), picked here as the simpler default per
//   docs/application-v2-apps.md step 4. If your app instead needs multiple independent
//   instances open at once (e.g. one window per some-id, like a distribution window per loot
//   session), swap this for the Map-keyed variant instead: `static instances = new Map()`,
//   key it in the constructor, and give `static open(key)` a `.get(key)`/`.set(key, this)`
//   shape — see scripts/apps/distribution.js:254-269,298-302,304-307 in the exemplar and
//   docs/application-v2-apps.md step 4 / "Instance tracking — Map-keyed" for the full pattern.

import { MODULE_ID } from "../config.mjs";

// REQUIRED — these are NOT bare globals in Foundry v13; they live under
// foundry.applications.api (exemplar: table-manager.js:26). Omitting this line makes the
// whole module fail to import at load ("HandlebarsApplicationMixin is not defined"), which
// silently kills init — caught in the 2026-07-16 live check.
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class WorldMapControlApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Singleton — one WorldMapControlApp window per client. Swap for a Map (see header) if not. */
  static instance = null;

  /** Focuses the existing window, or renders a new one. */
  static open() {
    if (WorldMapControlApp.instance) {
      WorldMapControlApp.instance.render(true);
      WorldMapControlApp.instance.bringToFront?.();
      return WorldMapControlApp.instance;
    }
    const app = new WorldMapControlApp();
    app.render(true);
    return app;
  }

  static DEFAULT_OPTIONS = {
    id: "twm-control",
    classes: ["twm", "twm-control"],
    window: { title: "TWM.WorldMapControl.Title", icon: "fas fa-map-location-dot", resizable: true },
    position: { width: 480, height: 360 },
    actions: {
      twmPing: WorldMapControlApp.#onExampleAction
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/twm-control.hbs` }
  };

  constructor(options = {}) {
    super(options);
    WorldMapControlApp.instance = this;
  }

  // Public close() override (never _onClose — see docs/application-v2-apps.md Gotchas /
  // scripts/apps/history.js:124-127). The `=== this` identity guard stops a stale/late
  // close() call from nulling out a newer singleton that has since replaced it.
  async close(options) {
    if (WorldMapControlApp.instance === this) WorldMapControlApp.instance = null;
    return super.close(options);
  }

  // ---------------------------------------------------------------------
  // Context preparation
  // ---------------------------------------------------------------------

  async _prepareContext() {
    // Replace with your app's real data. Kept deliberately trivial so this
    // template renders correctly with zero edits beyond placeholder substitution.
    return {
      title: game.i18n.localize("TWM.WorldMapControl.Title"),
      exampleValue: this.exampleValue ?? 0
    };
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  // One working action handler — private static, keyed off DEFAULT_OPTIONS.actions above
  // (the exemplar's universal shape across all 4 of its apps: `key: ClassName.#onHandler`,
  // see docs/application-v2-apps.md "Worked example"). Delete/replace once real actions exist.
  static async #onExampleAction(_event, _target) {
    this.exampleValue = (this.exampleValue ?? 0) + 1;
    await this.render();
  }
}
