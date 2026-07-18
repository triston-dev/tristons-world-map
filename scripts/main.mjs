// Entry point. App-tool overlay wiring per templates/app-tool/OVERLAY.md §2a (registerMenu)
// and §3a (socket init at ready); canvas layer + scene controls are this module's own
// Phase 2 additions (see scripts/canvas/world-map-layer.mjs header for the registration
// risk note).

import { MODULE_ID, LAYER_NAME } from "./config.mjs";
import { WorldMapControlApp } from "./apps/world-map-control.mjs";
import { initSocket } from "./core/socket-service.mjs";
import { WorldMapLayer } from "./canvas/world-map-layer.mjs";
import { registerSceneControls } from "./ui/scene-controls.mjs";
import { defaultPaceSets } from "./core/pace.mjs";
import { EncounterZoneBehavior } from "./regions/encounter-zone-behavior.mjs";
import { PerceptionTriggerBehavior } from "./regions/perception-trigger-behavior.mjs";
import { registerDayEvents } from "./core/day-events.mjs";

Hooks.once("init", () => {
  // Custom canvas layer — interface group, so it renders above the scene primitives.
  CONFIG.Canvas.layers[LAYER_NAME] = {
    layerClass: WorldMapLayer,
    group: "interface"
  };

  // Custom RegionBehavior sub-types (live-verified pattern: dnd5e registers its own the
  // same way). Types are declared in module.json documentTypes.
  Object.assign(CONFIG.RegionBehavior.dataModels, {
    [`${MODULE_ID}.encounterZone`]: EncounterZoneBehavior,
    [`${MODULE_ID}.perceptionTrigger`]: PerceptionTriggerBehavior
  });
  Object.assign(CONFIG.RegionBehavior.typeIcons, {
    [`${MODULE_ID}.encounterZone`]: "fa-solid fa-dice",
    [`${MODULE_ID}.perceptionTrigger`]: "fa-solid fa-eye"
  });

  registerDayEvents();

  // Editable travel pace sets (world-scoped, managed from the control panel's Paces tab).
  game.settings.register(MODULE_ID, "paceSets", {
    scope: "world",
    config: false,
    type: Array,
    default: defaultPaceSets()
  });

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
