// Per-pin edit dialog — ApplicationV2 form (Map-keyed instances: one window per pin id, per
// docs/application-v2-apps.md "Instance tracking — Map-keyed"). GM-only: only ever opened
// from GM-gated paths (layer pin tool, pin right-click, control panel).

import { MODULE_ID, PIN_TYPES, VISIBILITY, PIN_CLICK_ACTIONS, QUEST_STATUSES } from "../config.mjs";
import { makePin, getPin, createPin, updatePin, deletePin } from "../core/store.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PinConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** pinId (or "new") → open instance */
  static instances = new Map();

  /**
   * @param {Scene} scene
   * @param {object|null} pin   existing pin data, or null for a new pin
   * @param {object} initial    initial values for a new pin (x/y from the canvas click)
   */
  constructor(scene, pin, initial = {}, options = {}) {
    super(options);
    this.scene = scene;
    this.pin = pin;
    this.initial = initial;
    this.instanceKey = pin?.id ?? "new";
    PinConfigApp.instances.set(this.instanceKey, this);
  }

  static openForNew(scene, { x, y }) {
    const existing = PinConfigApp.instances.get("new");
    if (existing) {
      existing.initial = { x, y };
      existing.render(true);
      return existing;
    }
    const app = new PinConfigApp(scene, null, { x, y });
    app.render(true);
    return app;
  }

  static openForEdit(scene, pinId) {
    const existing = PinConfigApp.instances.get(pinId);
    if (existing) {
      existing.render(true);
      existing.bringToFront?.();
      return existing;
    }
    const pin = getPin(scene, pinId);
    if (!pin) return null;
    const app = new PinConfigApp(scene, pin);
    app.render(true);
    return app;
  }

  static DEFAULT_OPTIONS = {
    id: "twm-pin-config-{id}",
    classes: ["twm", "twm-pin-config"],
    tag: "form",
    window: { title: "TWM.PinConfig.Title", icon: "fas fa-map-pin", resizable: false },
    position: { width: 420, height: "auto" },
    form: {
      handler: PinConfigApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      twmDeletePin: PinConfigApp.#onDelete
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/twm-pin-config.hbs` }
  };

  get title() {
    return game.i18n.localize(this.pin ? "TWM.PinConfig.TitleEdit" : "TWM.PinConfig.Title");
  }

  async close(options) {
    if (PinConfigApp.instances.get(this.instanceKey) === this) {
      PinConfigApp.instances.delete(this.instanceKey);
    }
    return super.close(options);
  }

  async _prepareContext() {
    const pin = this.pin ?? makePin(this.initial);
    return {
      pin,
      isNew: !this.pin,
      types: Object.entries(PIN_TYPES).map(([key, def]) => ({
        key,
        label: game.i18n.localize(def.labelKey),
        selected: pin.type === key
      })),
      visibilities: Object.values(VISIBILITY).map((v) => ({
        key: v,
        label: game.i18n.localize(`TWM.Visibility.${v}`),
        selected: pin.visibility === v
      })),
      clickActions: PIN_CLICK_ACTIONS.map((a) => ({
        key: a,
        label: game.i18n.localize(`TWM.ClickActions.${a}`),
        selected: pin.clickAction === a
      })),
      questStatuses: ["", ...QUEST_STATUSES].map((s) => ({
        key: s,
        label: s ? game.i18n.localize(`TWM.QuestStatus.${s}`) : "—",
        selected: (pin.questStatus ?? "") === s
      }))
    };
  }

  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    if (data.questStatus !== undefined) data.questStatus = data.questStatus || null;
    if (this.pin) await updatePin(this.scene, this.pin.id, data);
    else await createPin(this.scene, { ...this.initial, ...data });
  }

  static async #onDelete(_event, _target) {
    if (!this.pin) return this.close();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("TWM.PinConfig.DeleteTitle") },
      content: `<p>${game.i18n.format("TWM.PinConfig.DeleteConfirm", {
        name: foundry.utils.escapeHTML(this.pin.name || game.i18n.localize("TWM.Pins.Unnamed"))
      })}</p>`
    });
    if (!confirmed) return;
    await deletePin(this.scene, this.pin.id);
    return this.close();
  }
}
