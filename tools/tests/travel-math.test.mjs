// Unit tests for scripts/core/travel-math.mjs (pure geometry — no shim needed, but installed
// for consistency with the suite).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

installShim();
const {
  dist, routeLengthPx, pxToUnits, unitsToPx, positionAlong, advanceAlongRoute,
  remainingPx, etaDays
} = await import("../../scripts/core/travel-math.mjs");

// A simple L-shaped route: 300px right, then 400px down. Total 700px.
const ROUTE = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }];

describe("travel-math", () => {
  it("dist + routeLengthPx", () => {
    assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
    assert.equal(routeLengthPx(ROUTE), 700);
    assert.equal(routeLengthPx([]), 0);
    assert.equal(routeLengthPx([{ x: 1, y: 1 }]), 0);
  });

  it("px ↔ units round-trips with grid scale", () => {
    // 100px grid, 6 miles per grid: 700px = 42 miles
    assert.equal(pxToUnits(700, 100, 6), 42);
    assert.equal(unitsToPx(42, 100, 6), 700);
    assert.equal(pxToUnits(100, 0, 6), 0); // guard: no grid
  });

  it("positionAlong interpolates within a segment", () => {
    assert.deepEqual(positionAlong(ROUTE, 0, 150), { x: 150, y: 0 });
    assert.deepEqual(positionAlong(ROUTE, 1, 200), { x: 300, y: 200 });
    assert.deepEqual(positionAlong(ROUTE, 5, 0), { x: 300, y: 400 }); // past end clamps
  });

  it("advanceAlongRoute crosses segment boundaries", () => {
    const r = advanceAlongRoute(ROUTE, 0, 0, 500);
    assert.equal(r.segmentIndex, 1);
    assert.equal(r.progressPx, 200);
    assert.deepEqual(r.pos, { x: 300, y: 200 });
    assert.equal(r.traveledPx, 500);
    assert.equal(r.finished, false);
  });

  it("advanceAlongRoute finishes exactly at route end and truncates traveled px", () => {
    const r = advanceAlongRoute(ROUTE, 0, 0, 10000);
    assert.equal(r.finished, true);
    assert.equal(r.traveledPx, 700);
    assert.deepEqual(r.pos, { x: 300, y: 400 });
  });

  it("advanceAlongRoute resumes mid-segment", () => {
    const r = advanceAlongRoute(ROUTE, 1, 100, 100);
    assert.equal(r.segmentIndex, 1);
    assert.equal(r.progressPx, 200);
    assert.equal(r.finished, false);
  });

  it("remainingPx from mid-route", () => {
    assert.equal(remainingPx(ROUTE, 0, 0), 700);
    assert.equal(remainingPx(ROUTE, 0, 150), 550);
    assert.equal(remainingPx(ROUTE, 1, 400), 0);
    assert.equal(remainingPx(ROUTE, 2, 0), 0);
  });

  it("etaDays", () => {
    assert.equal(etaDays(42, 24), 2);
    assert.equal(etaDays(24, 24), 1);
    assert.equal(etaDays(0, 24), 0);
    assert.equal(etaDays(10, 0), Infinity);
  });
});
