// Custom canvas InteractionLayer rendering everything Foundry lacks natively: pins with
// discovery states (Phase 2), travel trail / planned route / party marker (Phase 3).
//
// ⚠ Custom-layer registration is OUTSIDE the framework's verified docs corpus
// (docs/canvas-scene-and-hud.md "verified negative") — the registration shape used here
// (CONFIG.Canvas.layers[key] = { layerClass, group: "interface" } in init, class extending
// foundry.canvas.layers.InteractionLayer) is live-verified by this module's own Phase 2 spike.
// If Foundry changes it, the fallback is a plain PIXI.Container added to canvas.interface
// from the canvasReady hook (loses scene-control activation, keeps all rendering).

import { LAYER_NAME, MODULE_ID } from "../config.mjs";
import { getPins, isWorldMap, createPin, updatePin } from "../core/store.mjs";
import { isPinVisibleTo } from "../core/discovery.mjs";
import { PinObject } from "./pin-object.mjs";
import { hidePinTooltip } from "./tooltip.mjs";
import { PinConfigApp } from "../apps/pin-config.mjs";

export class WorldMapLayer extends foundry.canvas.layers.InteractionLayer {
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: LAYER_NAME,
      zIndex: 246
    });
  }

  /** id → PinObject */
  pinObjects = new Map();

  /** Containers, lowest to highest. Trail/route stay empty until Phase 3. */
  trailContainer = null;
  routeContainer = null;
  pinContainer = null;
  markerContainer = null;

  get scene() {
    return canvas.scene;
  }

  get active() {
    return ui.controls?.control?.name === LAYER_NAME;
  }

  async _draw(options) {
    await super._draw(options);
    this.trailContainer = this.addChild(new PIXI.Container());
    this.routeContainer = this.addChild(new PIXI.Container());
    this.pinContainer = this.addChild(new PIXI.Container());
    this.markerContainer = this.addChild(new PIXI.Container());
    // Pins must respond to hover/click for every user regardless of which layer is active.
    this.eventMode = "passive";
    this.pinContainer.eventMode = "passive";
    console.log(`${MODULE_ID} | WorldMapLayer drawn for scene "${this.scene?.name}"`);
    this.refresh();
  }

  async _tearDown(options) {
    hidePinTooltip();
    this.pinObjects.clear();
    return super._tearDown(options);
  }

  /** Full rebuild of module-rendered objects from scene flags. Cheap at world-map scale. */
  refresh() {
    if (!this.pinContainer) return;
    this.pinContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.pinObjects.clear();
    if (!this.scene || !isWorldMap(this.scene)) return;

    const pins = getPins(this.scene);
    const viewer = { isGM: game.user.isGM };
    for (const pin of Object.values(pins)) {
      if (!isPinVisibleTo(pin, viewer)) continue;
      const obj = new PinObject(pin, this);
      this.pinContainer.addChild(obj);
      this.pinObjects.set(pin.id, obj);
    }
  }

  /** Left-click on empty layer space: with the pin tool active (GM), place a new pin. */
  _onClickLeft(event) {
    if (!game.user.isGM) return;
    const tool = game.activeTool;
    if (tool !== "pin") return;
    const pos = event.interactionData?.origin ?? event.getLocalPosition(canvas.stage);
    PinConfigApp.openForNew(this.scene, { x: Math.round(pos.x), y: Math.round(pos.y) });
  }

  /** GM drag-save from PinObject (already moved visually) — persist the new position. */
  async persistPinPosition(pin, x, y) {
    if (!game.user.isGM) return;
    await updatePin(this.scene, pin.id, { x: Math.round(x), y: Math.round(y) });
  }
}
