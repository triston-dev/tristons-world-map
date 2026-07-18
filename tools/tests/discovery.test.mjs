// Unit tests for scripts/core/discovery.mjs — the pin-privacy state machine. The player
// projection test is the module's highest-value regression guard: GM-only content must never
// serialize into a player-facing pins map.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

installShim();
const { VISIBILITY } = await import("../../scripts/config.mjs");
const { isPinVisibleTo, revealChanges, hideChanges, projectPinsForPlayer } =
  await import("../../scripts/core/discovery.mjs");

const pin = (visibility, extra = {}) => ({
  id: "p1", x: 0, y: 0, type: "location", name: "P", visibility,
  gmNotes: "SECRET", discoveredOn: null, ...extra
});

describe("isPinVisibleTo", () => {
  it("GM sees everything", () => {
    for (const v of Object.values(VISIBILITY)) {
      assert.equal(isPinVisibleTo(pin(v), { isGM: true }), true, v);
    }
  });

  it("players see visible + discovered only", () => {
    assert.equal(isPinVisibleTo(pin(VISIBILITY.VISIBLE), { isGM: false }), true);
    assert.equal(isPinVisibleTo(pin(VISIBILITY.DISCOVERED), { isGM: false }), true);
    assert.equal(isPinVisibleTo(pin(VISIBILITY.HIDDEN), { isGM: false }), false);
    assert.equal(isPinVisibleTo(pin(VISIBILITY.GM), { isGM: false }), false);
  });
});

describe("revealChanges", () => {
  it("hidden → discovered, stamping the day", () => {
    assert.deepEqual(revealChanges(pin(VISIBILITY.HIDDEN), 37),
      { visibility: VISIBILITY.DISCOVERED, discoveredOn: 37 });
  });

  it("gm-only pins are NEVER revealed", () => {
    assert.equal(revealChanges(pin(VISIBILITY.GM), 37), null);
  });

  it("already-visible states are a no-op", () => {
    assert.equal(revealChanges(pin(VISIBILITY.VISIBLE), 1), null);
    assert.equal(revealChanges(pin(VISIBILITY.DISCOVERED), 1), null);
  });
});

describe("hideChanges", () => {
  it("discovered/visible → hidden, clearing the day", () => {
    assert.deepEqual(hideChanges(pin(VISIBILITY.DISCOVERED, { discoveredOn: 5 })),
      { visibility: VISIBILITY.HIDDEN, discoveredOn: null });
    assert.deepEqual(hideChanges(pin(VISIBILITY.VISIBLE)),
      { visibility: VISIBILITY.HIDDEN, discoveredOn: null });
  });

  it("gm/hidden are a no-op", () => {
    assert.equal(hideChanges(pin(VISIBILITY.GM)), null);
    assert.equal(hideChanges(pin(VISIBILITY.HIDDEN)), null);
  });
});

describe("projectPinsForPlayer — the privacy guard", () => {
  const pins = {
    a: pin(VISIBILITY.VISIBLE, { id: "a" }),
    b: pin(VISIBILITY.DISCOVERED, { id: "b", discoveredOn: 12 }),
    c: pin(VISIBILITY.HIDDEN, { id: "c" }),
    d: pin(VISIBILITY.GM, { id: "d" })
  };

  it("filters out hidden and gm-only pins entirely", () => {
    const projected = projectPinsForPlayer(pins);
    assert.deepEqual(Object.keys(projected).sort(), ["a", "b"]);
  });

  it("strips gmNotes from every projected pin", () => {
    const projected = projectPinsForPlayer(pins);
    for (const p of Object.values(projected)) {
      assert.equal("gmNotes" in p, false);
    }
  });

  it("no projected pin ever carries visibility gm or hidden", () => {
    const projected = projectPinsForPlayer(pins);
    for (const p of Object.values(projected)) {
      assert.notEqual(p.visibility, VISIBILITY.GM);
      assert.notEqual(p.visibility, VISIBILITY.HIDDEN);
    }
  });

  it("does not mutate the source pins", () => {
    projectPinsForPlayer(pins);
    assert.equal(pins.a.gmNotes, "SECRET");
  });
});
