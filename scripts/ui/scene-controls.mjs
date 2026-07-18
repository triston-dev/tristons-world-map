// Scene-controls wiring — v13 RECORD shape: `controls` is an object keyed by control name,
// each control's `tools` likewise a record (v12's array-push shape breaks on v13; see the
// plan's risk list). Layer activation happens via the control's onChange, matching how core
// v13 controls activate their layers.

import { LAYER_NAME } from "../config.mjs";
import { isWorldMap, setWorldMapEnabled } from "../core/store.mjs";
import { WorldMapControlApp } from "../apps/world-map-control.mjs";

export function registerSceneControls(controls) {
  if (!game.user.isGM) return; // Phase 2: editing tools are GM-only; players see pins regardless.

  controls[LAYER_NAME] = {
    name: LAYER_NAME,
    order: 90,
    title: "TWM.Controls.Title",
    icon: "fas fa-map-location-dot",
    activeTool: "select",
    onChange: (_event, active) => {
      if (active) canvas[LAYER_NAME]?.activate();
    },
    onToolChange: () => {},
    tools: {
      select: {
        name: "select",
        order: 1,
        title: "TWM.Controls.Select",
        icon: "fas fa-expand"
      },
      pin: {
        name: "pin",
        order: 2,
        title: "TWM.Controls.PlacePin",
        icon: "fas fa-map-pin"
      },
      route: {
        name: "route",
        order: 3,
        title: "TWM.Controls.DrawRoute",
        icon: "fas fa-route"
      },
      marker: {
        name: "marker",
        order: 4,
        title: "TWM.Controls.PlaceMarker",
        icon: "fas fa-flag"
      },
      toggleMap: {
        name: "toggleMap",
        order: 5,
        title: "TWM.Controls.ToggleWorldMap",
        icon: "fas fa-globe",
        button: true,
        onChange: async () => {
          const scene = canvas.scene;
          if (!scene) return;
          const next = !isWorldMap(scene);
          await setWorldMapEnabled(scene, next);
          ui.notifications.info(game.i18n.format(
            next ? "TWM.Controls.WorldMapEnabled" : "TWM.Controls.WorldMapDisabled",
            { scene: scene.name }
          ));
        }
      },
      panel: {
        name: "panel",
        order: 6,
        title: "TWM.Controls.OpenPanel",
        icon: "fas fa-sliders",
        button: true,
        onChange: () => WorldMapControlApp.open()
      }
    }
  };
}
