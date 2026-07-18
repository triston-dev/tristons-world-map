// The shared party marker: a banner/flag PIXI sprite at travelState.marker. The GM — or the
// designated navigator player — can drag it; everyone else sees it read-only. Navigator
// drops route through the moveMarker socket intent (GM-authoritative).

import { getTravelState } from "../core/store.mjs";

export class PartyMarker extends PIXI.Container {
  /**
   * @param {{x,y}} pos
   * @param {WorldMapLayer} layer
   */
  constructor(pos, layer) {
    super();
    this.layer = layer;
    this.position.set(pos.x, pos.y);
    this.#size = Math.max(28, Math.round((canvas.dimensions?.size ?? 100) * 0.55));
    this.#draw();
    const isNavigator = getTravelState(layer.scene).navigatorUserId === game.user.id;
    if (game.user.isGM || isNavigator) {
      this.eventMode = "static";
      this.cursor = "grab";
      this.hitArea = new PIXI.Rectangle(-this.#size * 0.4, -this.#size, this.#size * 1.1, this.#size * 1.1);
      this.on("pointerdown", this.#onPointerDown, this);
      this.on("pointerup", this.#onPointerUp, this);
      this.on("pointerupoutside", this.#onPointerUp, this);
    }
  }

  #size = 32;
  #dragging = false;
  #moveListener = null;

  #draw() {
    const s = this.#size;
    const g = new PIXI.Graphics();
    // Pole
    g.lineStyle(Math.max(3, s * 0.08), 0x333333, 1);
    g.moveTo(0, 0);
    g.lineTo(0, -s);
    // Pennant
    g.lineStyle(Math.max(2, s * 0.04), 0x7a1f1f, 1);
    g.beginFill(0xd93a3a, 0.95);
    g.moveTo(0, -s);
    g.lineTo(s * 0.7, -s * 0.8);
    g.lineTo(0, -s * 0.58);
    g.closePath();
    g.endFill();
    // Base dot
    g.lineStyle(0);
    g.beginFill(0x333333, 1);
    g.drawCircle(0, 0, Math.max(3, s * 0.09));
    g.endFill();
    this.addChild(g);
  }

  #onPointerDown(event) {
    if (event.button !== 0) return;
    this.#dragging = true;
    this.cursor = "grabbing";
    this.#moveListener = (e) => {
      if (!this.#dragging) return;
      const pos = e.getLocalPosition(this.layer);
      this.position.set(pos.x, pos.y);
    };
    canvas.stage.on("pointermove", this.#moveListener);
  }

  async #onPointerUp() {
    if (!this.#dragging) return;
    this.#dragging = false;
    this.cursor = "grab";
    if (this.#moveListener) {
      canvas.stage.off("pointermove", this.#moveListener);
      this.#moveListener = null;
    }
    if (game.user.isGM) {
      await this.layer.persistMarkerPosition(this.position.x, this.position.y);
      return;
    }
    // Navigator: request the move; the flag update re-renders the marker authoritatively.
    const { sendIntent } = await import("../core/socket-service.mjs");
    await sendIntent("moveMarker", {
      sceneId: this.layer.scene.id,
      x: Math.round(this.position.x),
      y: Math.round(this.position.y)
    });
  }
}
