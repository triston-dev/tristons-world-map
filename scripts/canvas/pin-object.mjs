// A single map pin: PIXI.Container with a teardrop marker (type-colored Graphics), optional
// circular image inset, GM badges for hidden/gm-only pins, drag-move for the GM, hover
// tooltip, and click actions (journal / scene / macro).
//
// Deliberately plain PIXI (eventMode "static" + pointer events) rather than a Foundry
// Placeable — pins are flag data, not documents.

import { MODULE_ID, PIN_TYPES, VISIBILITY } from "../config.mjs";
import { showPinTooltip, hidePinTooltip } from "./tooltip.mjs";

export class PinObject extends PIXI.Container {
  /**
   * @param {object} pin      the pin flag data
   * @param {WorldMapLayer} layer
   */
  constructor(pin, layer) {
    super();
    this.pin = pin;
    this.layer = layer;
    this.position.set(pin.x, pin.y);
    this.eventMode = "static";
    this.cursor = "pointer";

    this.#size = Math.max(24, Math.round((canvas.dimensions?.size ?? 100) * 0.45));
    this.#draw();

    this.hitArea = new PIXI.Circle(0, -this.#size * 0.55, this.#size * 0.75);

    this.on("pointerover", this.#onPointerOver, this);
    this.on("pointerout", this.#onPointerOut, this);
    this.on("pointerdown", this.#onPointerDown, this);
    this.on("pointerup", this.#onPointerUp, this);
    this.on("pointerupoutside", this.#onPointerUp, this);
    this.on("rightdown", this.#onRightDown, this);
  }

  #size = 32;
  #dragging = false;
  #dragMoved = false;

  get typeDef() {
    return PIN_TYPES[this.pin.type] ?? PIN_TYPES.location;
  }

  #draw() {
    const s = this.#size;
    const r = s * 0.5;
    const color = this.typeDef.color;
    const isGM = game.user.isGM;
    const g = new PIXI.Graphics();

    // Teardrop: circle head centered above the anchor point, tapering to (0,0).
    g.lineStyle(Math.max(2, s * 0.06), 0x222222, 0.9);
    g.beginFill(color, 0.95);
    g.drawCircle(0, -s * 0.55, r);
    g.endFill();
    g.beginFill(color, 0.95);
    g.moveTo(-r * 0.55, -s * 0.28);
    g.lineTo(0, 0);
    g.lineTo(r * 0.55, -s * 0.28);
    g.closePath();
    g.endFill();
    // Inner dot for contrast when no image is set.
    g.beginFill(0xffffff, 0.9);
    g.drawCircle(0, -s * 0.55, r * 0.32);
    g.endFill();
    this.addChild(g);

    // Optional image inset, masked into the marker head.
    if (this.pin.img) this.#drawImage(r, s).catch((err) =>
      console.warn(`${MODULE_ID} | pin image failed to load: ${this.pin.img}`, err));

    // GM-only badges: eye-slash ring for hidden, dark ring for gm-only.
    if (isGM && (this.pin.visibility === VISIBILITY.HIDDEN || this.pin.visibility === VISIBILITY.GM)) {
      const badge = new PIXI.Graphics();
      const badgeColor = this.pin.visibility === VISIBILITY.GM ? 0x111111 : 0xcccccc;
      badge.lineStyle(Math.max(2, s * 0.08), badgeColor, 1);
      badge.drawCircle(0, -s * 0.55, r + s * 0.1);
      this.addChild(badge);
      this.alpha = 0.75;
    }
  }

  async #drawImage(r, s) {
    const load = foundry.canvas.loadTexture ?? loadTexture;
    const tex = await load(this.pin.img);
    if (!tex || this.destroyed) return;
    const sprite = new PIXI.Sprite(tex);
    const d = r * 2 * 0.86;
    const scale = d / Math.max(tex.width, tex.height);
    sprite.scale.set(scale);
    sprite.anchor.set(0.5);
    sprite.position.set(0, -s * 0.55);
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawCircle(0, -s * 0.55, r * 0.86 * 0.5 * 2);
    mask.endFill();
    sprite.mask = mask;
    this.addChild(sprite);
    this.addChild(mask);
  }

  // -------------------------------------------------------------------------
  // Hover tooltip
  // -------------------------------------------------------------------------

  #onPointerOver(event) {
    if (this.#dragging) return;
    showPinTooltip(this.pin, event.clientX, event.clientY);
  }

  #onPointerOut() {
    hidePinTooltip();
  }

  // -------------------------------------------------------------------------
  // Drag (GM, select tool) + click actions
  // -------------------------------------------------------------------------

  #onPointerDown(event) {
    if (event.button !== 0) return;
    if (!game.user.isGM) return;
    this.#dragging = true;
    this.#dragMoved = false;
    hidePinTooltip();
    this.#moveListener = (e) => this.#onDragMove(e);
    canvas.stage.on("pointermove", this.#moveListener);
  }

  #moveListener = null;

  #onDragMove(event) {
    if (!this.#dragging) return;
    this.#dragMoved = true;
    const pos = event.getLocalPosition(this.layer);
    this.position.set(pos.x, pos.y);
  }

  async #onPointerUp(event) {
    if (this.#moveListener) {
      canvas.stage.off("pointermove", this.#moveListener);
      this.#moveListener = null;
    }
    const wasDrag = this.#dragging && this.#dragMoved;
    this.#dragging = false;
    if (wasDrag) {
      await this.layer.persistPinPosition(this.pin, this.position.x, this.position.y);
      return;
    }
    if (event.button === 0) await this.#onClickAction();
  }

  /** Right-click: GM opens the pin config. */
  #onRightDown(event) {
    if (!game.user.isGM) return;
    event.stopPropagation();
    hidePinTooltip();
    import("../apps/pin-config.mjs").then(({ PinConfigApp }) =>
      PinConfigApp.openForEdit(this.layer.scene, this.pin.id));
  }

  async #onClickAction() {
    const pin = this.pin;
    switch (pin.clickAction) {
      case "journal": {
        if (!pin.journalUuid) return;
        const doc = await fromUuid(pin.journalUuid);
        doc?.sheet?.render(true);
        break;
      }
      case "scene": {
        if (!pin.sceneUuid) return;
        const scene = await fromUuid(pin.sceneUuid);
        if (!scene) return;
        if (game.user.isGM) scene.view();
        else ui.notifications.info(game.i18n.localize("TWM.Pins.TravelHereHint"));
        break;
      }
      case "macro": {
        if (!pin.macroUuid) return;
        const macro = await fromUuid(pin.macroUuid);
        macro?.execute();
        break;
      }
      default:
        break;
    }
  }
}
