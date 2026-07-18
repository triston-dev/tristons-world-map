// The GM control panel — ApplicationV2 singleton (pattern per docs/application-v2-apps.md,
// exemplar tristons-loot-generator). Tabs: Pins, Travel (routes + day-ticker), Paces,
// Settings. Form inputs save on change; buttons are data-action handlers.

import { MODULE_ID, PIN_TYPES, VISIBILITY, ROUTE_STATUS } from "../config.mjs";
import {
  isWorldMap, setWorldMapEnabled, getPins, getRoutes, getTravelState, getMapConfig,
  updateMapConfig, deleteRoute, updatePin, updateTravelState, getTrail, clearTrail
} from "../core/store.mjs";
import { revealChanges, hideChanges } from "../core/discovery.mjs";
import {
  getPaceSets, savePaceSets, startRoute, stopTravel, travelDays, activeReadout
} from "../core/travel-service.mjs";
import { makeCustomPaceSet } from "../core/pace.mjs";
import { PinConfigApp } from "./pin-config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class WorldMapControlApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Singleton — one window per client. */
  static instance = null;

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
    tag: "form",
    window: { title: "TWM.WorldMapControl.Title", icon: "fas fa-map-location-dot", resizable: true },
    position: { width: 560, height: 640 },
    form: {
      handler: WorldMapControlApp.#onFormChange,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      twmTab: WorldMapControlApp.#onTab,
      twmEnableMap: WorldMapControlApp.#onEnableMap,
      twmEditPin: WorldMapControlApp.#onEditPin,
      twmTogglePin: WorldMapControlApp.#onTogglePin,
      twmActivateRoute: WorldMapControlApp.#onActivateRoute,
      twmDeleteRoute: WorldMapControlApp.#onDeleteRoute,
      twmTravelDay: WorldMapControlApp.#onTravelDay,
      twmTravelStop: WorldMapControlApp.#onTravelStop,
      twmClearTrail: WorldMapControlApp.#onClearTrail,
      twmAddPaceSet: WorldMapControlApp.#onAddPaceSet
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/twm-control.hbs` }
  };

  activeTab = "pins";

  constructor(options = {}) {
    super(options);
    WorldMapControlApp.instance = this;
  }

  async close(options) {
    if (WorldMapControlApp.instance === this) WorldMapControlApp.instance = null;
    return super.close(options);
  }

  get scene() {
    return canvas.scene;
  }

  async _prepareContext() {
    const scene = this.scene;
    const enabled = scene ? isWorldMap(scene) : false;
    const tabs = ["pins", "travel", "paces", "settings"].map((id) => ({
      id,
      label: game.i18n.localize(`TWM.Panel.Tabs.${id}`),
      active: this.activeTab === id
    }));

    const context = {
      sceneName: scene?.name ?? "—",
      enabled,
      tabs,
      tabPins: this.activeTab === "pins",
      tabTravel: this.activeTab === "travel",
      tabPaces: this.activeTab === "paces",
      tabSettings: this.activeTab === "settings"
    };
    if (!scene || !enabled) return context;

    const state = getTravelState(scene);
    const paceSets = getPaceSets();
    const activeSet = paceSets.find((s) => s.id === state.paceSetId) ?? paceSets[0];

    if (context.tabPins) {
      context.pins = Object.values(getPins(scene)).map((pin) => ({
        ...pin,
        typeIcon: (PIN_TYPES[pin.type] ?? PIN_TYPES.location).icon,
        typeLabel: game.i18n.localize((PIN_TYPES[pin.type] ?? PIN_TYPES.location).labelKey),
        visLabel: game.i18n.localize(`TWM.Visibility.${pin.visibility}`),
        canReveal: pin.visibility === VISIBILITY.HIDDEN,
        canHide: pin.visibility === VISIBILITY.DISCOVERED || pin.visibility === VISIBILITY.VISIBLE,
        displayName: pin.name || game.i18n.localize("TWM.Pins.Unnamed")
      }));
    }

    if (context.tabTravel) {
      const routes = Object.values(getRoutes(scene));
      const readout = activeReadout(scene);
      context.routes = routes.map((r) => ({
        ...r,
        statusLabel: game.i18n.localize(`TWM.Routes.Status.${r.status}`),
        isActive: r.status === ROUTE_STATUS.ACTIVE,
        waypointCount: r.waypoints.length
      }));
      context.travel = {
        day: state.day,
        hasActive: Boolean(state.activeRouteId),
        activeRouteName: routes.find((r) => r.id === state.activeRouteId)?.name ?? null,
        markerPlaced: Boolean(state.marker),
        trailLength: getTrail(scene).length,
        readout: readout ? {
          remaining: Math.round(readout.remainingUnits * 10) / 10,
          unitLabel: readout.unitLabel,
          perDay: readout.perDay,
          eta: Number.isFinite(readout.eta) ? readout.eta : "—",
          timeLabel: readout.timeLabel
        } : null,
        paceSets: paceSets.map((s) => ({ id: s.id, name: s.name, selected: s.id === state.paceSetId })),
        paces: activeSet.paces.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.perDay} ${activeSet.unitLabel}/${activeSet.timeLabel})${p.note ? ` — ${p.note}` : ""}`,
          selected: p.id === state.paceId
        }))
      };
    }

    if (context.tabPaces) {
      context.paceSets = paceSets.map((s) => ({
        ...s,
        paces: s.paces.map((p) => ({ ...p, setId: s.id }))
      }));
    }

    if (context.tabSettings) {
      context.mapConfig = getMapConfig(scene);
      context.gridSize = scene.grid.size;
    }

    return context;
  }

  // -------------------------------------------------------------------------
  // Form change handler (submitOnChange) — routes by input name prefix
  // -------------------------------------------------------------------------

  static async #onFormChange(_event, _form, formData) {
    const scene = this.scene;
    if (!scene) return;
    const data = foundry.utils.expandObject(formData.object);

    if (data.mapConfig) {
      await updateMapConfig(scene, {
        distancePerGrid: Number(data.mapConfig.distancePerGrid) || 1,
        unitLabel: String(data.mapConfig.unitLabel || "miles"),
        advanceWorldTime: Boolean(data.mapConfig.advanceWorldTime)
      });
    }
    if (data.travel) {
      const changes = {};
      if (data.travel.paceSetId) changes.paceSetId = data.travel.paceSetId;
      if (data.travel.paceId) changes.paceId = data.travel.paceId;
      if (Object.keys(changes).length) await updateTravelState(scene, changes);
    }
    if (data.paceSets) {
      const sets = getPaceSets();
      for (const set of sets) {
        const edits = data.paceSets[set.id];
        if (!edits) continue;
        if (edits.name) set.name = String(edits.name);
        if (edits.unitLabel) set.unitLabel = String(edits.unitLabel);
        if (edits.timeLabel) set.timeLabel = String(edits.timeLabel);
        for (const pace of set.paces) {
          const pe = edits.paces?.[pace.id];
          if (!pe) continue;
          if (pe.perDay !== undefined) pace.perDay = Number(pe.perDay) || pace.perDay;
          if (pe.name) pace.name = String(pe.name);
          if (pe.note !== undefined) pace.note = String(pe.note);
        }
      }
      await savePaceSets(sets);
    }
    this.render();
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  static #onTab(_event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }

  static async #onEnableMap() {
    if (!this.scene) return;
    await setWorldMapEnabled(this.scene, true);
    this.render();
  }

  static #onEditPin(_event, target) {
    PinConfigApp.openForEdit(this.scene, target.dataset.pinId);
  }

  static async #onTogglePin(_event, target) {
    const pin = getPins(this.scene)[target.dataset.pinId];
    if (!pin) return;
    const day = getTravelState(this.scene).day;
    const changes = pin.visibility === VISIBILITY.HIDDEN ? revealChanges(pin, day) : hideChanges(pin);
    if (changes) await updatePin(this.scene, pin.id, changes);
    this.render();
  }

  static async #onActivateRoute(_event, target) {
    await startRoute(this.scene, target.dataset.routeId);
    this.render();
  }

  static async #onDeleteRoute(_event, target) {
    const route = getRoutes(this.scene)[target.dataset.routeId];
    if (!route) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("TWM.Routes.DeleteTitle") },
      content: `<p>${game.i18n.format("TWM.Routes.DeleteConfirm", { name: foundry.utils.escapeHTML(route.name) })}</p>`
    });
    if (!confirmed) return;
    const state = getTravelState(this.scene);
    if (state.activeRouteId === route.id) await stopTravel(this.scene);
    await deleteRoute(this.scene, route.id);
    this.render();
  }

  static async #onTravelDay(_event, target) {
    const n = Number(target.dataset.days ?? this.element.querySelector("[name='travelDays']")?.value) || 1;
    await travelDays(this.scene, n);
    this.render();
  }

  static async #onTravelStop() {
    await stopTravel(this.scene);
    this.render();
  }

  static async #onClearTrail() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("TWM.Travel.ClearTrailTitle") },
      content: `<p>${game.i18n.localize("TWM.Travel.ClearTrailConfirm")}</p>`
    });
    if (confirmed) {
      await clearTrail(this.scene);
      this.render();
    }
  }

  static async #onAddPaceSet() {
    const sets = getPaceSets();
    sets.push(makeCustomPaceSet(sets));
    await savePaceSets(sets);
    this.render();
  }
}
