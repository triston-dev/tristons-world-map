// Custom canvas InteractionLayer rendering everything Foundry lacks natively: pins with
// discovery states (Phase 2), travel trail / planned route / party marker (Phase 3).
//
// Custom-layer registration (CONFIG.Canvas.layers[key] = { layerClass, group: "interface" }
// in init, class extending foundry.canvas.layers.InteractionLayer) was LIVE-VERIFIED on
// Foundry 13.351 in this module's Phase 2 spike (2026-07-17): layer constructed, drawn into
// InterfaceCanvasGroup, zIndex honored, scene-control activation working. Fallback if a
// future core version breaks it: plain PIXI.Container added to canvas.interface on
// canvasReady (loses scene-control activation, keeps rendering).

import { LAYER_NAME, MODULE_ID } from "../config.mjs";
import {
  getPins, isWorldMap, updatePin, getRoutes, getTrail, getTravelState,
  createRoute, updateTravelState
} from "../core/store.mjs";
import { isPinVisibleTo } from "../core/discovery.mjs";
import { PinObject } from "./pin-object.mjs";
import { hidePinTooltip } from "./tooltip.mjs";
import { renderRoutes, renderTrail } from "./route-renderer.mjs";
import { PartyMarker } from "./party-marker.mjs";
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

  /** In-progress route draft (GM route tool): array of {x,y}, or null. */
  routeDraft = null;

  /** Containers, lowest to highest. */
  trailContainer = null;
  routeContainer = null;
  pinContainer = null;
  markerContainer = null;

  get scene() {
    return canvas.scene;
  }

  async _draw(options) {
    await super._draw(options);
    this.trailContainer = this.addChild(new PIXI.Container());
    this.routeContainer = this.addChild(new PIXI.Container());
    this.pinContainer = this.addChild(new PIXI.Container());
    this.markerContainer = this.addChild(new PIXI.Container());
    this.eventMode = "passive";
    this.pinContainer.eventMode = "passive";
    this.markerContainer.eventMode = "passive";
    console.log(`${MODULE_ID} | WorldMapLayer drawn for scene "${this.scene?.name}"`);
    this.refresh();
  }

  async _tearDown(options) {
    hidePinTooltip();
    this.pinObjects.clear();
    this.routeDraft = null;
    return super._tearDown(options);
  }

  /** Full rebuild of module-rendered objects from scene flags. Cheap at world-map scale. */
  refresh() {
    if (!this.pinContainer) return;
    this.pinContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.markerContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.pinObjects.clear();
    renderRoutes(this.routeContainer, {}, null);
    renderTrail(this.trailContainer, []);
    if (!this.scene || !isWorldMap(this.scene)) return;

    // Pins
    const pins = getPins(this.scene);
    const viewer = { isGM: game.user.isGM };
    for (const pin of Object.values(pins)) {
      if (!isPinVisibleTo(pin, viewer)) continue;
      const obj = new PinObject(pin, this);
      this.pinContainer.addChild(obj);
      this.pinObjects.set(pin.id, obj);
    }

    // Routes + draft + trail
    renderRoutes(this.routeContainer, getRoutes(this.scene), this.routeDraft);
    renderTrail(this.trailContainer, getTrail(this.scene));

    // Party marker
    const state = getTravelState(this.scene);
    if (state.marker) {
      this.markerContainer.addChild(new PartyMarker(state.marker, this));
    }
  }

  // -------------------------------------------------------------------------
  // Tool interactions (GM)
  // -------------------------------------------------------------------------

  _onClickLeft(event) {
    if (!game.user.isGM) return;
    const tool = game.activeTool;
    const pos = event.interactionData?.origin ?? event.getLocalPosition(canvas.stage);
    const point = { x: Math.round(pos.x), y: Math.round(pos.y) };

    if (tool === "pin") {
      PinConfigApp.openForNew(this.scene, point);
      return;
    }
    if (tool === "route") {
      this.routeDraft ??= [];
      this.routeDraft.push(point);
      renderRoutes(this.routeContainer, getRoutes(this.scene), this.routeDraft);
      return;
    }
    if (tool === "marker") {
      updateTravelState(this.scene, { marker: point });
      return;
    }
  }

  /** Right-click with the route tool: finish (≥2 points) or cancel the draft. */
  _onClickRight(_event) {
    if (!game.user.isGM) return;
    if (game.activeTool !== "route" || !this.routeDraft) return;
    this.finishRouteDraft();
  }

  async finishRouteDraft() {
    const draft = this.routeDraft;
    this.routeDraft = null;
    if (!draft || draft.length < 2) {
      this.refresh();
      return null;
    }
    const count = Object.keys(getRoutes(this.scene)).length + 1;
    const route = await createRoute(this.scene, {
      name: game.i18n.format("TWM.Routes.DefaultName", { n: count }),
      waypoints: draft,
      createdBy: game.user.id
    });
    ui.notifications.info(game.i18n.format("TWM.Routes.Created", { name: route.name }));
    return route;
  }

  cancelRouteDraft() {
    this.routeDraft = null;
    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Persistence callbacks from canvas objects
  // -------------------------------------------------------------------------

  /** GM drag-save from PinObject (already moved visually) — persist the new position. */
  async persistPinPosition(pin, x, y) {
    if (!game.user.isGM) return;
    await updatePin(this.scene, pin.id, { x: Math.round(x), y: Math.round(y) });
  }

  /** GM drag-save from PartyMarker. */
  async persistMarkerPosition(x, y) {
    if (!game.user.isGM) return;
    await updateTravelState(this.scene, { marker: { x: Math.round(x), y: Math.round(y) } });
  }
}
