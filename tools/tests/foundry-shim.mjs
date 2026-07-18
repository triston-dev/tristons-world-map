// Generalized from tristons-loot-generator tests/foundry-shim.js:1-82
// (Triston's Loot Generator/tests/foundry-shim.js) — same mock surface (game, foundry, Hooks,
// ui), same installShim({...}) signature and no-import structure. The source file already has
// zero imports, so no vitest-specific code needed removing — the only change here is dropping
// loot-gen's own domain-specific settings defaults (tableOverrides/customTables/sessions/
// keywordRules, its getDefault() helper) since those belong to that module's settings schema,
// not a generic template. Per docs/testing-foundry-logic.md: CONFIG/CONST are intentionally NOT
// mocked — any code path touching CONFIG.*/CONST.* is out of scope for this harness by design
// and needs local-verification.md instead.
//
// Runner-agnostic plain ESM: imports nothing from any test runner (no vitest, no node:test),
// so `node --test` (the house standard, docs/testing-foundry-logic.md) can import this file
// directly, same as any other runner could.
//
// Usage (per docs/testing-foundry-logic.md step 3): call installShim({...}) in your test's
// beforeEach, THEN import the module under test — Foundry-global reads at module scope only
// see whatever globals exist at import time.

export function installShim({ modules = {}, settings = {}, user = {}, users = [], actors = [], activeGMId } = {}) {
  const store = { ...settings };
  const socketHandlers = {};
  const socketEmitted = [];
  const socket = {
    on: (name, handler) => {
      (socketHandlers[name] ??= []).push(handler);
    },
    emit: (name, payload) => {
      socketEmitted.push({ name, payload });
    },
    // test helper: not part of the real Foundry API
    _trigger: (name, payload) => {
      for (const handler of socketHandlers[name] ?? []) handler(payload);
    }
  };
  const resolvedActiveGMId = activeGMId ?? users.find((u) => u.isGM && u.active)?.id ?? null;
  globalThis.game = {
    settings: {
      get: (ns, key) => structuredClone(store[`${ns}.${key}`]),
      set: async (ns, key, value) => { store[`${ns}.${key}`] = structuredClone(value); return value; }
    },
    modules: { get: (id) => modules[id] },
    i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
    user: { id: "gm1", isGM: true, ...user },
    users: {
      activeGM: resolvedActiveGMId ? users.find((u) => u.id === resolvedActiveGMId) ?? { id: resolvedActiveGMId } : null,
      get: (id) => users.find((u) => u.id === id) ?? null
    },
    actors: {
      filter: (fn) => actors.filter(fn)
    },
    socket
  };
  globalThis.foundry = {
    utils: {
      randomID: () => Math.random().toString(36).slice(2, 12),
      deepClone: (o) => structuredClone(o),
      escapeHTML: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      saveDataToFile: () => {}
    },
    applications: {
      api: {
        // Minimal fakes: sufficient to IMPORT app modules that subclass these
        // and reference DialogV2 statics inside method bodies (not at class-
        // definition time). Not a real ApplicationV2 — no rendering support.
        ApplicationV2: class {
          static DEFAULT_OPTIONS = {};
          static PARTS = {};
          render() { return this; }
          close() { return this; }
        },
        HandlebarsApplicationMixin: (Base) => Base,
        DialogV2: class {
          static async confirm() { return false; }
          static async prompt() { return null; }
          static async wait() { return null; }
        }
      },
      ux: {
        FormDataExtended: class {
          constructor(form) { this.object = form ?? {}; }
        },
        TextEditor: {
          implementation: { getDragEventData: () => null },
          getDragEventData: () => null
        }
      },
      handlebars: {
        loadTemplates: async () => {}
      }
    }
  };
  globalThis.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  globalThis.ui = { notifications: { warn: () => {}, info: () => {}, error: () => {} } };
  return { store, socket, socketEmitted };
}
