// GM-authoritative socket intent queue — architecture from tristons-loot-generator
// scripts/core/socket-service.js via the app-tool overlay (docs/sockets-and-multiplayer.md).
// `validateIntent` stays PURE (no Foundry globals) for unit coverage; processIntent gathers a
// context snapshot GM-side and delegates. The `queue = queue.then(work)` chain serializes
// GM-side processing.
//
// Real intents (Phase 5):
//   createPlayerPin { sceneId, x, y, name, blurb }   — any player; capped per user
//   proposeRoute    { sceneId, waypoints[], name }   — any player; lands as status "proposed"
//   moveMarker      { sceneId, x, y }                — designated navigator (or GM) only

import { MODULE_ID, VISIBILITY } from "../config.mjs";
import { getPins, createPin, createRoute, updateTravelState, getTravelState, isWorldMap } from "./store.mjs";
import { ROUTE_STATUS } from "../config.mjs";

export const SOCKET_NAME = `module.${MODULE_ID}`;

/** Max player-created pins per user per scene. */
export const PLAYER_PIN_CAP = 10;
/** Max waypoints accepted in a proposed route. */
export const MAX_WAYPOINTS = 50;

let queue = Promise.resolve();

/** Test helper: reset the processing queue to a clean state. Not a production call site. */
export function _resetQueue() {
  queue = Promise.resolve();
}

/** Test/diagnostic helper: resolves once every intent enqueued so far has finished. */
export function _flushQueue() {
  return queue;
}

// isPrimaryGM gating — NOT the same check as `game.user.isGM`: only the activeGM processes.
export function isPrimaryGM() {
  return game.users.activeGM?.id === game.user.id;
}

/**
 * PURE. No Foundry globals, no mutation of inputs.
 * @param {string} action
 * @param {object} payload
 * @param {{id: string, isGM: boolean}} user
 * @param {object} ctx  GM-gathered snapshot: { sceneExists, sceneIsMap, navigatorUserId,
 *                      playerPinCount }
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateIntent(action, payload, user, ctx = {}) {
  if (!ctx.sceneExists) return { ok: false, reason: "TWM.Intent.NoScene" };
  if (!ctx.sceneIsMap) return { ok: false, reason: "TWM.Intent.NotAMap" };

  switch (action) {
    case "createPlayerPin": {
      if (!Number.isFinite(payload?.x) || !Number.isFinite(payload?.y)) {
        return { ok: false, reason: "TWM.Intent.BadPayload" };
      }
      if ((ctx.playerPinCount ?? 0) >= PLAYER_PIN_CAP) {
        return { ok: false, reason: "TWM.Intent.PinCapReached" };
      }
      return { ok: true };
    }
    case "proposeRoute": {
      const wps = payload?.waypoints;
      if (!Array.isArray(wps) || wps.length < 2 || wps.length > MAX_WAYPOINTS) {
        return { ok: false, reason: "TWM.Intent.BadPayload" };
      }
      if (!wps.every((w) => Number.isFinite(w?.x) && Number.isFinite(w?.y))) {
        return { ok: false, reason: "TWM.Intent.BadPayload" };
      }
      return { ok: true };
    }
    case "moveMarker": {
      if (!Number.isFinite(payload?.x) || !Number.isFinite(payload?.y)) {
        return { ok: false, reason: "TWM.Intent.BadPayload" };
      }
      if (!user.isGM && user.id !== ctx.navigatorUserId) {
        return { ok: false, reason: "TWM.Intent.NotNavigator" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: "TWM.Intent.UnknownAction" };
  }
}

/** Applies a validated intent (GM client). */
async function applyIntent(action, payload, user, scene) {
  switch (action) {
    case "createPlayerPin": {
      await createPin(scene, {
        x: Math.round(payload.x),
        y: Math.round(payload.y),
        name: String(payload.name ?? "").slice(0, 60),
        blurb: String(payload.blurb ?? "").slice(0, 200),
        type: "player",
        visibility: VISIBILITY.VISIBLE,
        clickAction: "none",
        createdBy: user.id
      });
      break;
    }
    case "proposeRoute": {
      const route = await createRoute(scene, {
        name: String(payload.name ?? "").slice(0, 60) || game.i18n.localize("TWM.Routes.ProposedDefaultName"),
        waypoints: payload.waypoints.slice(0, MAX_WAYPOINTS),
        status: ROUTE_STATUS.PROPOSED,
        proposedBy: user.id,
        createdBy: user.id
      });
      const proposer = game.users.get(user.id)?.name ?? "?";
      ui.notifications.info(game.i18n.format("TWM.Routes.ProposedNotify", { user: proposer, name: route.name }));
      break;
    }
    case "moveMarker": {
      await updateTravelState(scene, { marker: { x: Math.round(payload.x), y: Math.round(payload.y) } });
      break;
    }
    default:
      break;
  }
}

// SECURITY: `trusted` is true ONLY for the primary GM's own local sendIntent path. Socket-
// delivered msg.userId is attacker-controlled; capping isGM=false for wire intents closes
// the GM-privilege-escalation hole. Residual player-spoofs-player risk is accepted per the
// exemplar's design ruling (docs/sockets-and-multiplayer.md step 11).
function buildUserContext(userId, trusted) {
  const requester = game.users.get(userId);
  const isGM = trusted && Boolean(requester?.isGM);
  return { id: userId, isGM };
}

function emitToast(userId, message) {
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize(message));
    return;
  }
  game.socket.emit(SOCKET_NAME, { type: "toast", userId, message });
}

/** Gather the pure-validation context snapshot for a scene + user (GM client). */
function buildIntentContext(payload, userId) {
  const scene = payload?.sceneId ? game.scenes.get(payload.sceneId) : null;
  const pins = scene ? getPins(scene) : {};
  return {
    scene,
    ctx: {
      sceneExists: Boolean(scene),
      sceneIsMap: scene ? isWorldMap(scene) : false,
      navigatorUserId: scene ? getTravelState(scene).navigatorUserId : null,
      playerPinCount: Object.values(pins).filter((p) => p.type === "player" && p.createdBy === userId).length
    }
  };
}

/**
 * Processes a single intent GM-side. Always resolves — failures become toasts. The fixed-key
 * error toast (never raw err.message) is the load-bearing security rule; preserve verbatim.
 */
async function processIntent({ action, payload, userId }, trusted) {
  try {
    const user = buildUserContext(userId, trusted);
    const { scene, ctx } = buildIntentContext(payload, userId);

    const result = validateIntent(action, payload, user, ctx);
    if (!result.ok) {
      emitToast(userId, result.reason);
      return;
    }
    await applyIntent(action, payload, user, scene);
  } catch (err) {
    console.error(`${MODULE_ID} | unexpected error processing intent`, err);
    emitToast(userId, "TWM.Intent.UnexpectedError");
  }
}

function enqueueIntent(intent, trusted) {
  queue = queue.then(() => processIntent(intent, trusted));
  return queue;
}

// Registration happens once, from the ready hook (game.socket needs a live session).
export function initSocket() {
  game.socket.on(SOCKET_NAME, (msg) => {
    if (msg?.type === "intent") {
      if (!isPrimaryGM()) return;
      enqueueIntent(msg, false);
      return;
    }
    if (msg?.type === "toast") {
      if (msg.userId === game.user.id) ui.notifications.warn(game.i18n.localize(msg.message));
    }
  });
}

/** Sender: local-trusted vs. wire-untrusted branch, with a no-GM guard toast. */
export async function sendIntent(action, payload) {
  if (isPrimaryGM()) {
    await enqueueIntent({ action, payload, userId: game.user.id }, true);
    return;
  }
  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("TWM.Intent.NoGM"));
    return;
  }
  game.socket.emit(SOCKET_NAME, { type: "intent", action, payload, userId: game.user.id });
}
