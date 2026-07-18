// OPTIONAL component — only wire this in if WorldMapControlApp needs multiplayer coordination
// (a non-GM player triggering a world-state mutation). Skip this file entirely for a
// GM-only or purely-local tool; see OVERLAY.md "Socket wiring (optional)".
//
// Generalized from tristons-loot-generator scripts/core/socket-service.js (whole file, 292
// lines is the pattern — docs/sockets-and-multiplayer.md), converted .js -> .mjs per this
// project's plain-ESM house stack (CLAUDE.md #2). All citations below are `path:line` into
// `C:\Users\trist\Desktop\Triston's Loot Generator\scripts\core\socket-service.js` unless noted.
//
// Architecture (verbatim-in-spirit from socket-service.js:1-18): `validateIntent` is PURE (no
// Foundry globals, no mutation of its inputs) so every rule gets isolated unit coverage.
// Everything else here is a thin Foundry-facing wrapper that gathers context and delegates to
// it. The `queue` module-level variable is the ONE permitted mutable module state — intents
// arrive as independent async socket events, but a world-setting read-modify-write is NOT
// atomic across concurrent callers, so `queue = queue.then(work)` forces GM-side processing to
// run strictly one-at-a-time in arrival order.

import { MODULE_ID } from "../config.mjs";

// module.<module-id> socket name, from config — socket-service.js:20 imports SOCKET_NAME from
// ../config.js where it's exported as `` `module.${MODULE_ID}` `` (scripts/config.js:2).
// docs/sockets-and-multiplayer.md step 1: "the standard Foundry convention... define it once as
// a constant so sender and receiver never risk a typo'd string diverging."
export const SOCKET_NAME = `module.${MODULE_ID}`;

let queue = Promise.resolve();

/** Test helper: reset the processing queue to a clean state. Not a production call site. */
export function _resetQueue() {
  queue = Promise.resolve();
}

/**
 * Test/diagnostic helper: resolves once every intent enqueued so far has finished processing
 * (success or failure). Cited: socket-service.js:36-38.
 */
export function _flushQueue() {
  return queue;
}

// isPrimaryGM gating — socket-service.js:40-42. NOT the same check as `game.user.isGM`: a
// table can have more than one GM-flagged user, only the `activeGM` should process intents.
export function isPrimaryGM() {
  return game.users.activeGM?.id === game.user.id;
}

/**
 * PURE. No Foundry globals, no mutation of session/user/payload. Replace the example "ping"
 * action below with your module's real intent kinds — socket-service.js:54-73 is the dispatcher
 * shape (a switch over `action`, delegating to per-action `validate*` functions).
 *
 * @param {string} action
 * @param {object} payload
 * @param {{id: string, isGM: boolean}} user
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateIntent(action, payload, user) {
  switch (action) {
    case "ping":
      return { ok: true };
    default:
      return { ok: false, reason: "TWM.Intent.UnknownAction" };
  }
}

/**
 * Applies a validated intent to a draft world-state object. Replace with your module's real
 * mutation(s) — mirrors socket-service.js:150-182 `applyMutation`'s switch-over-action shape.
 */
function applyMutation(action, payload, draft) {
  switch (action) {
    case "ping":
      draft.count = (draft.count ?? 0) + 1;
      break;
    default:
      break;
  }
}

// SECURITY: `trusted` must be `true` ONLY for intents processed via the local sendIntent()
// path (the primary GM's own client, never crossing the wire). Foundry module sockets carry
// no server-verified sender identity — `msg.userId` on a socket-delivered intent is entirely
// attacker-controlled. Capping `isGM = false` for anything that arrived via socket closes the
// GM-privilege-escalation hole; it is safe because the primary GM's own actions never arrive
// via socket (sendIntent processes them locally, `trusted: true`). Cited verbatim-in-spirit
// from socket-service.js:194-219's own SECURITY comment.
//
// Residual risk (accepted per the exemplar's own design ruling, sockets-and-multiplayer.md
// step 11): Foundry provides no verified sender for module sockets at all — a player spoofing
// another PLAYER's userId can still act on that player's behalf. Only the GM-privilege-
// escalation vector is closeable with this pattern; document the rest as an accepted limitation.
function buildUserContext(userId, trusted) {
  const requester = game.users.get(userId);
  const isGM = trusted && Boolean(requester?.isGM);
  return { id: userId, isGM };
}

function emitToast(userId, message) {
  // No socket loopback: a GM processing their OWN intent locally (sendIntent's trusted path)
  // would never see their own toast if we always emitted. Show it directly instead.
  // Cited: socket-service.js:221-233.
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize(message));
    return;
  }
  game.socket.emit(SOCKET_NAME, { type: "toast", userId, message });
}

/**
 * Processes a single intent GM-side. Always resolves (never rejects) so it is safe to chain
 * onto the serialization queue without wedging it: any failure — validation or unexpected
 * throw — is turned into a toast back to the requesting user. Cited: socket-service.js:235-263.
 */
async function processIntent({ action, payload, userId }, trusted) {
  try {
    const user = buildUserContext(userId, trusted);

    const result = validateIntent(action, payload, user);
    if (!result.ok) {
      emitToast(userId, result.reason);
      return;
    }

    // Replace with your module's real state read/mutate/write (e.g. a
    // game.settings.get/set round-trip through your own store module).
    const draft = {};
    applyMutation(action, payload, draft);
  } catch (err) {
    // Defensive: an unexpected throw must still surface as a toast and must not propagate out
    // of the queue. ALWAYS use the FIXED key here — never the raw err.message, which may leak
    // internal detail to the requesting client. The real error is still logged for the GM
    // operator. This is the load-bearing security rule of this whole file — preserve it
    // verbatim in any adaptation (socket-service.js:176-186, comment kept in spirit):
    console.error(`${MODULE_ID} | unexpected error processing intent`, err);
    emitToast(userId, "TWM.Intent.UnexpectedError");
  }
}

function enqueueIntent(intent, trusted) {
  queue = queue.then(() => processIntent(intent, trusted));
  return queue;
}

// Registration happens once, from the ready hook (not init — game.socket needs the
// world/session to be live). Cited: socket-service.js:270-283, docs/sockets-and-multiplayer.md
// step 2.
export function initSocket() {
  game.socket.on(SOCKET_NAME, (msg) => {
    if (msg?.type === "intent") {
      if (!isPrimaryGM()) return;
      // arrivedViaSocket: never trusted, regardless of msg.userId — see the SECURITY comment
      // on buildUserContext above.
      enqueueIntent(msg, false);
      return;
    }
    if (msg?.type === "toast") {
      if (msg.userId === game.user.id) ui.notifications.warn(game.i18n.localize(msg.message));
    }
  });
}

// Sender: local-trusted vs. wire-untrusted branch. Cited: socket-service.js:285-292.
export async function sendIntent(action, payload) {
  if (isPrimaryGM()) {
    // Local path: never crosses the wire, so it is trusted.
    await enqueueIntent({ action, payload, userId: game.user.id }, true);
    return;
  }
  game.socket.emit(SOCKET_NAME, { type: "intent", action, payload, userId: game.user.id });
}
