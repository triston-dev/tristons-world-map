// Unit tests for scripts/core/socket-service.mjs: pure validateIntent rules + the full
// wire round-trip via the shim's socket._trigger (untrusted path) per the exemplar suite.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installShim } from "./foundry-shim.mjs";

const GM = { id: "gm1", isGM: true, active: true, name: "GM" };
const PLAYER = { id: "p1", isGM: false, active: true, name: "Player" };

installShim({ users: [GM, PLAYER], activeGMId: "gm1" });
const { MODULE_ID } = await import("../../scripts/config.mjs");
const svc = await import("../../scripts/core/socket-service.mjs");

const CTX_OK = { sceneExists: true, sceneIsMap: true, navigatorUserId: "p1", playerPinCount: 0 };
const asPlayer = { id: "p1", isGM: false };
const asGM = { id: "gm1", isGM: true };

describe("validateIntent (pure)", () => {
  it("rejects everything on a missing or non-map scene", () => {
    assert.equal(svc.validateIntent("createPlayerPin", { x: 1, y: 1 }, asPlayer,
      { ...CTX_OK, sceneExists: false }).reason, "TWM.Intent.NoScene");
    assert.equal(svc.validateIntent("createPlayerPin", { x: 1, y: 1 }, asPlayer,
      { ...CTX_OK, sceneIsMap: false }).reason, "TWM.Intent.NotAMap");
  });

  it("unknown action rejected with the fixed key", () => {
    assert.equal(svc.validateIntent("nuke", {}, asPlayer, CTX_OK).reason, "TWM.Intent.UnknownAction");
  });

  it("createPlayerPin: coordinates required, cap enforced", () => {
    assert.equal(svc.validateIntent("createPlayerPin", { x: 5, y: 9 }, asPlayer, CTX_OK).ok, true);
    assert.equal(svc.validateIntent("createPlayerPin", { x: "a", y: 9 }, asPlayer, CTX_OK).reason, "TWM.Intent.BadPayload");
    assert.equal(svc.validateIntent("createPlayerPin", { x: 5, y: 9 }, asPlayer,
      { ...CTX_OK, playerPinCount: svc.PLAYER_PIN_CAP }).reason, "TWM.Intent.PinCapReached");
  });

  it("proposeRoute: needs 2..MAX valid waypoints", () => {
    const wp = (n) => Array.from({ length: n }, (_, i) => ({ x: i, y: i }));
    assert.equal(svc.validateIntent("proposeRoute", { waypoints: wp(2) }, asPlayer, CTX_OK).ok, true);
    assert.equal(svc.validateIntent("proposeRoute", { waypoints: wp(1) }, asPlayer, CTX_OK).ok, false);
    assert.equal(svc.validateIntent("proposeRoute", { waypoints: wp(svc.MAX_WAYPOINTS + 1) }, asPlayer, CTX_OK).ok, false);
    assert.equal(svc.validateIntent("proposeRoute", { waypoints: [{ x: 1, y: 1 }, { x: "z", y: 2 }] }, asPlayer, CTX_OK).ok, false);
  });

  it("moveMarker: navigator or GM only", () => {
    assert.equal(svc.validateIntent("moveMarker", { x: 1, y: 2 }, asPlayer, CTX_OK).ok, true);
    assert.equal(svc.validateIntent("moveMarker", { x: 1, y: 2 }, { id: "p2", isGM: false }, CTX_OK).reason,
      "TWM.Intent.NotNavigator");
    assert.equal(svc.validateIntent("moveMarker", { x: 1, y: 2 }, asGM,
      { ...CTX_OK, navigatorUserId: null }).ok, true);
  });
});

describe("wire round-trip (shim socket._trigger, untrusted path)", () => {
  let scene, socket;

  beforeEach(() => {
    ({ socket } = installShim({ users: [GM, PLAYER], activeGMId: "gm1" }));
    scene = {
      id: "s1",
      flags: { [MODULE_ID]: { enabled: true } },
      async update(changes) {
        for (const [path, value] of Object.entries(changes)) {
          const parts = path.split(".");
          let t = scene;
          for (let i = 0; i < parts.length - 1; i++) t = t[parts[i]] ??= {};
          const last = parts.at(-1);
          if (last.startsWith("-=")) delete t[last.slice(2)];
          else t[last] = value;
        }
        return scene;
      }
    };
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };
    svc._resetQueue();
    svc.initSocket();
  });

  it("createPlayerPin lands as a capped, visible, player-typed pin", async () => {
    socket._trigger(svc.SOCKET_NAME, {
      type: "intent", action: "createPlayerPin", userId: "p1",
      payload: { sceneId: "s1", x: 10.6, y: 20.2, name: "Camp", blurb: "We slept here" }
    });
    await svc._flushQueue();
    const pins = Object.values(scene.flags[MODULE_ID].pins ?? {});
    assert.equal(pins.length, 1);
    assert.equal(pins[0].type, "player");
    assert.equal(pins[0].visibility, "visible");
    assert.equal(pins[0].createdBy, "p1");
    assert.equal(pins[0].x, 11);
    assert.equal(pins[0].name, "Camp");
  });

  it("proposeRoute lands with status proposed and proposer id", async () => {
    socket._trigger(svc.SOCKET_NAME, {
      type: "intent", action: "proposeRoute", userId: "p1",
      payload: { sceneId: "s1", waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }], name: "Shortcut" }
    });
    await svc._flushQueue();
    const routes = Object.values(scene.flags[MODULE_ID].routes ?? {});
    assert.equal(routes.length, 1);
    assert.equal(routes[0].status, "proposed");
    assert.equal(routes[0].proposedBy, "p1");
  });

  it("moveMarker from non-navigator is rejected with a toast, no state change", async () => {
    const { socketEmitted } = { socketEmitted: [] };
    socket._trigger(svc.SOCKET_NAME, {
      type: "intent", action: "moveMarker", userId: "p1",
      payload: { sceneId: "s1", x: 500, y: 600 }
    });
    await svc._flushQueue();
    // navigatorUserId is null in scene flags → p1 is not navigator (wire intents are never GM).
    assert.equal(scene.flags[MODULE_ID].travelState?.marker, undefined);
  });

  it("moveMarker from the designated navigator applies", async () => {
    scene.flags[MODULE_ID].travelState = { navigatorUserId: "p1" };
    socket._trigger(svc.SOCKET_NAME, {
      type: "intent", action: "moveMarker", userId: "p1",
      payload: { sceneId: "s1", x: 500, y: 600 }
    });
    await svc._flushQueue();
    assert.deepEqual(scene.flags[MODULE_ID].travelState.marker, { x: 500, y: 600 });
  });

  it("wire intents NEVER get GM privileges even with a GM userId (spoof guard)", async () => {
    // GM userId arriving via socket: buildUserContext caps isGM=false; moveMarker then
    // requires navigator status, which gm1 doesn't have → rejected.
    socket._trigger(svc.SOCKET_NAME, {
      type: "intent", action: "moveMarker", userId: "gm1",
      payload: { sceneId: "s1", x: 1, y: 2 }
    });
    await svc._flushQueue();
    assert.equal(scene.flags[MODULE_ID].travelState?.marker, undefined);
  });
});
