// Entry point. App-tool overlay wiring per templates/app-tool/OVERLAY.md §2a (registerMenu)
// and §3a (socket init at ready); canvas layer + scene controls are this module's own
// Phase 2 additions (see scripts/canvas/world-map-layer.mjs header for the registration
// risk note).

import { MODULE_ID, LAYER_NAME } from "./config.mjs";
import { WorldMapControlApp } from "./apps/world-map-control.mjs";
import { initSocket } from "./core/socket-service.mjs";
import { WorldMapLayer } from "./canvas/world-map-layer.mjs";
import { registerSceneControls } from "./ui/scene-controls.mjs";

Hooks.once("init", () => {
  // Custom canvas layer — interface group, so it renders above the scene primitives.
  CONFIG.Canvas.layers[LAYER_NAME] = {
    layerClass: WorldMapLayer,
    group: "interface"
  };

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

Hooks.on("getSceneControlButtons", registerSceneControls);

// Re-render module canvas objects whenever this module's scene flags change.
Hooks.on("updateScene", (scene, changes) => {
  if (scene.id !== canvas.scene?.id) return;
  if (!changes.flags?.[MODULE_ID]) return;
  canvas[LAYER_NAME]?.refresh();
});

Hooks.once("ready", () => {
  initSocket();
});
