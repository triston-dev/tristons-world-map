// Unit tests for scripts/core/travel-engine.mjs (the pure day-tick reducer) and pace.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

installShim();
const { tickDay, routeReadout } = await import("../../scripts/core/travel-engine.mjs");
const { normalizePaceSets, defaultPaceSets, getPaceSet, getPace, makeCustomPaceSet } =
  await import("../../scripts/core/pace.mjs");

// 100px grid, 6 miles/grid → 24 miles/day (normal) = 400px/day.
const GRID = 100;
const MAP_CONFIG = { distancePerGrid: 6, unitLabel: "miles" };
const ROUTE = { id: "r1", waypoints: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 900 }] }; // 1200px = 72mi
const STATE = { day: 0, segmentIndex: 0, progressPx: 0, paceSetId: "dnd5e-overland", paceId: "normal" };

const tick = (state) => tickDay({
  travelState: state, route: ROUTE, gridPx: GRID, mapConfig: MAP_CONFIG, paceSets: defaultPaceSets()
});

describe("travel-engine tickDay", () => {
  it("advances one day at normal pace (24mi = 400px)", () => {
    const r = tick(STATE);
    assert.equal(r.travelState.day, 1);
    assert.equal(r.moved.units, 24);
    assert.equal(r.finished, false);
    // 400px along the L route: 300 right + 100 down.
    assert.deepEqual(r.travelState.marker, { x: 300, y: 100 });
    assert.equal(r.travelState.segmentIndex, 1);
    assert.equal(r.travelState.progressPx, 100);
  });

  it("three days completes the 72mi route exactly", () => {
    let state = STATE;
    let result;
    for (let i = 0; i < 3; i++) {
      result = tick(state);
      state = result.travelState;
    }
    assert.equal(state.day, 3);
    assert.equal(result.finished, true);
    assert.deepEqual(state.marker, { x: 300, y: 900 });
  });

  it("respects pace choice (slow 18mi = 300px)", () => {
    const r = tick({ ...STATE, paceId: "slow" });
    assert.equal(r.moved.units, 18);
    assert.deepEqual(r.travelState.marker, { x: 300, y: 0 });
  });

  it("applies weather speed multiplier", () => {
    const r = tick({ ...STATE, weather: { speedMult: 0.5 } });
    assert.equal(r.moved.units, 12);
  });

  it("routeReadout reports remaining distance and ETA", () => {
    const r = routeReadout({
      travelState: { ...STATE, segmentIndex: 1, progressPx: 100 },
      route: ROUTE, gridPx: GRID, mapConfig: MAP_CONFIG, paceSets: defaultPaceSets()
    });
    assert.equal(r.remainingUnits, 48); // 800px left
    assert.equal(r.eta, 2);
    assert.equal(r.unitLabel, "miles");
  });
});

describe("pace", () => {
  it("normalizePaceSets falls back to defaults on garbage", () => {
    assert.deepEqual(normalizePaceSets(null), defaultPaceSets());
    assert.deepEqual(normalizePaceSets([]), defaultPaceSets());
    assert.deepEqual(normalizePaceSets([{ id: "x", paces: [] }]), defaultPaceSets());
  });

  it("normalizePaceSets keeps valid custom sets and drops bad paces", () => {
    const sets = normalizePaceSets([{
      id: "sw5e", name: "SW5e Hyperspace", unitLabel: "parsecs", timeLabel: "day",
      paces: [{ id: "cruise", name: "Cruise", perDay: 3 }, { id: "bad", perDay: -1 }]
    }]);
    assert.equal(sets.length, 1);
    assert.equal(sets[0].unitLabel, "parsecs");
    assert.equal(sets[0].paces.length, 1);
    assert.equal(sets[0].paces[0].perDay, 3);
  });

  it("getPaceSet/getPace fall back sensibly", () => {
    const sets = defaultPaceSets();
    assert.equal(getPaceSet(sets, "nope").id, "dnd5e-overland");
    assert.equal(getPace(sets[0], "nope").id, "normal"); // middle pace fallback
  });

  it("makeCustomPaceSet generates unique ids", () => {
    const sets = defaultPaceSets();
    const c1 = makeCustomPaceSet(sets);
    sets.push(c1);
    const c2 = makeCustomPaceSet(sets);
    assert.notEqual(c1.id, c2.id);
    assert.equal(c1.paces.length, 3);
  });
});
