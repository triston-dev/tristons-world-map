// Entry-point shape generalized from tristons-transformations scripts/module.mjs:1-8
// (Grim Hollow/Tooling/tristons-transformations/scripts/module.mjs) — the
// `Hooks.once("init")` top-level registration block. App-tool overlay wiring per
// templates/app-tool/OVERLAY.md §2a (registerMenu entry point) and §3a (socket init at ready).

import { MODULE_ID } from "./config.mjs";
import { WorldMapControlApp } from "./apps/world-map-control.mjs";
import { initSocket } from "./core/socket-service.mjs";

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "worldMapControl", {
    name: "TWM.WorldMapControl.Title",
    label: "TWM.WorldMapControl.MenuLabel",
    hint: "TWM.WorldMapControl.MenuHint",
    icon: "fas fa-map-location-dot",
    type: WorldMapControlApp,
    restricted: true
  });

  console.log(`${MODULE_ID} | loaded`);
});

Hooks.once("ready", () => {
  initSocket();
});
