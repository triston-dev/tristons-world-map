// Trivial wiring-proof test, assembled per docs/testing-foundry-logic.md steps 3 and 6
// (shim-then-import ordering; node --test as the house runner) — not copied from either
// exemplar verbatim (transformations' own tools/tests/state.test.mjs tests real content-
// specific logic, not the shim itself). This file exists so a fresh scaffold has a passing
// suite proving the shim + runner wiring works before any real module code is written.

import { test } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

test("installShim installs game/foundry/Hooks/ui globals", () => {
  installShim({ settings: { "tristons-world-map.exampleSetting": true } });

  assert.equal(typeof globalThis.game, "object");
  assert.equal(typeof globalThis.foundry, "object");
  assert.equal(typeof globalThis.Hooks, "object");
  assert.equal(typeof globalThis.ui, "object");
  assert.equal(globalThis.game.settings.get("tristons-world-map", "exampleSetting"), true);
});

test("installShim's game.settings.get returns undefined for unset keys (no domain-specific defaults)", () => {
  installShim({});
  assert.equal(globalThis.game.settings.get("tristons-world-map", "neverSet"), undefined);
});
