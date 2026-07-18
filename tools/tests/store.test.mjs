// Unit tests for scripts/core/store.mjs — flag-shape round-trips against a mock scene
// (docs/testing-foundry-logic.md "pure core"). The mock's update() applies granular dot-path
// semantics the same way Foundry does for the paths the store emits, including the
// `-=key: null` deletion syntax.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

installShim();
const { MODULE_ID } = await import("../../scripts/config.mjs");
const store = await import("../../scripts/core/store.mjs");

/** Minimal mock Scene: flags object + Foundry-style dot-path update(). */
function mockScene(flags = {}) {
  const scene = {
    flags,
    async update(changes) {
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split(".");
        let target = scene;
        for (let i = 0; i < parts.length - 1; i++) {
          target = target[parts[i]] ??= {};
        }
        const last = parts.at(-1);
        if (last.startsWith("-=")) delete target[last.slice(2)];
        else if (typeof value === "object" && value !== null && !Array.isArray(value)
          && typeof target[last] === "object" && target[last] !== null) {
          Object.assign(target[last], value);
        } else target[last] = value;
      }
      return scene;
    }
  };
  return scene;
}

describe("store", () => {
  let scene;
  beforeEach(() => {
    scene = mockScene();
  });

  it("isWorldMap false by default, true after setWorldMapEnabled", async () => {
    assert.equal(store.isWorldMap(scene), false);
    await store.setWorldMapEnabled(scene, true);
    assert.equal(store.isWorldMap(scene), true);
    await store.setWorldMapEnabled(scene, false);
    assert.equal(store.isWorldMap(scene), false);
  });

  it("makePin fills defaults, keeps known keys, drops unknown keys", () => {
    const pin = store.makePin({ x: 100.6, y: 200, name: "Waterdeep", nonsense: "zzz" });
    assert.equal(pin.x, 100.6);
    assert.equal(pin.name, "Waterdeep");
    assert.equal(pin.type, "location");
    assert.equal(pin.visibility, "visible");
    assert.equal(pin.clickAction, "journal");
    assert.equal("nonsense" in pin, false);
    assert.equal(typeof pin.id, "string");
    assert.ok(pin.id.length >= 8);
  });

  it("createPin persists under flags.<module>.pins.<id> and returns the pin", async () => {
    const pin = await store.createPin(scene, { x: 10, y: 20, name: "A" });
    assert.deepEqual(store.getPin(scene, pin.id), pin);
    assert.equal(scene.flags[MODULE_ID].pins[pin.id].name, "A");
  });

  it("updatePin only touches the named keys (no sibling clobber)", async () => {
    const a = await store.createPin(scene, { x: 1, y: 1, name: "A" });
    const b = await store.createPin(scene, { x: 2, y: 2, name: "B" });
    await store.updatePin(scene, a.id, { name: "A2" });
    assert.equal(store.getPin(scene, a.id).name, "A2");
    assert.equal(store.getPin(scene, a.id).x, 1);
    assert.equal(store.getPin(scene, b.id).name, "B");
  });

  it("deletePin removes exactly one pin via -= syntax", async () => {
    const a = await store.createPin(scene, { x: 1, y: 1 });
    const b = await store.createPin(scene, { x: 2, y: 2 });
    await store.deletePin(scene, a.id);
    assert.equal(store.getPin(scene, a.id), null);
    assert.notEqual(store.getPin(scene, b.id), null);
  });

  it("newId produces unique 16-char alphanumeric ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => store.newId()));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.match(id, /^[a-z0-9]{16}$/i);
  });
});
