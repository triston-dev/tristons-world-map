// Unit tests for the Phase 6 pure cores: weather, supplies, chronicle text builder.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

installShim();
const { DEFAULT_WEATHER, pickWeighted, rollDefaultWeather, parseSpeedMult, weatherDisplayName } =
  await import("../../scripts/core/weather.mjs");
const { consumeSupplies, suppliesEnabled } = await import("../../scripts/core/supplies.mjs");
const { buildDayHtml } = await import("../../scripts/core/chronicle.mjs");

describe("weather", () => {
  it("pickWeighted respects weights deterministically", () => {
    const entries = [{ id: "a", weight: 1 }, { id: "b", weight: 3 }];
    assert.equal(pickWeighted(entries, 0.0).id, "a");
    assert.equal(pickWeighted(entries, 0.24).id, "a");
    assert.equal(pickWeighted(entries, 0.26).id, "b");
    assert.equal(pickWeighted(entries, 0.99).id, "b");
  });

  it("rollDefaultWeather returns a {current, speedMult} shape", () => {
    const w = rollDefaultWeather(0);
    assert.equal(w.current, DEFAULT_WEATHER[0].name);
    assert.equal(typeof w.speedMult, "number");
  });

  it("parseSpeedMult reads [xN] tags and defaults to 1", () => {
    assert.equal(parseSpeedMult("Blizzard [x0.5]"), 0.5);
    assert.equal(parseSpeedMult("Storm [X 0.75]"), 0.75);
    assert.equal(parseSpeedMult("Clear"), 1);
    assert.equal(parseSpeedMult("Weird [x0]"), 1);
    assert.equal(parseSpeedMult(null), 1);
  });

  it("weatherDisplayName strips the tag", () => {
    assert.equal(weatherDisplayName("Blizzard [x0.5]"), "Blizzard");
    assert.equal(weatherDisplayName("Clear"), "Clear");
  });
});

describe("supplies", () => {
  it("consumes per member per day", () => {
    const r = consumeSupplies({ rations: 20, perMemberPerDay: 1, warnAt: 5 }, 4);
    assert.equal(r.supplies.rations, 16);
    assert.equal(r.consumed, 4);
    assert.equal(r.warning, false);
    assert.equal(r.empty, false);
  });

  it("warns exactly when crossing the threshold", () => {
    const r = consumeSupplies({ rations: 8, perMemberPerDay: 1, warnAt: 5 }, 4);
    assert.equal(r.supplies.rations, 4);
    assert.equal(r.warning, true);
    const again = consumeSupplies(r.supplies, 4);
    assert.equal(again.warning, false); // already below threshold before consuming
    assert.equal(again.empty, true);
    assert.equal(again.supplies.rations, 0);
  });

  it("never goes negative and only reports empty on the crossing day", () => {
    const empty = consumeSupplies({ rations: 0, perMemberPerDay: 1, warnAt: 5 }, 4);
    assert.equal(empty.supplies.rations, 0);
    assert.equal(empty.empty, false); // was already empty
  });

  it("suppliesEnabled: -1 rations disables tracking", () => {
    assert.equal(suppliesEnabled({ rations: -1, perMemberPerDay: 1 }), false);
    assert.equal(suppliesEnabled({ rations: 10, perMemberPerDay: 1 }), true);
    assert.equal(suppliesEnabled({ rations: 10, perMemberPerDay: 0 }), false);
    assert.equal(suppliesEnabled(undefined), false);
  });
});

describe("chronicle buildDayHtml", () => {
  it("renders day heading, distance, and escaped event list", () => {
    const html = buildDayHtml({ day: 7, units: 24, unitLabel: "miles" },
      ["Encounter in The Wildlands: 2 owlbears", "Discovered: <Hidden> Shrine"]);
    assert.match(html, /<h3>Day 7<\/h3>/);
    assert.match(html, /Traveled 24 miles\./);
    assert.match(html, /2 owlbears/);
    assert.match(html, /&lt;Hidden&gt; Shrine/);
    assert.doesNotMatch(html, /<Hidden>/);
  });

  it("omits the list entirely when no events", () => {
    const html = buildDayHtml({ day: 1, units: 18, unitLabel: "parsecs" }, []);
    assert.doesNotMatch(html, /<ul>/);
    assert.match(html, /18 parsecs/);
  });
});
