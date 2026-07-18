// Generalized from tristons-transformations scripts/config.mjs:1
// (Grim Hollow/Tooling/tristons-transformations/scripts/config.mjs) — the MODULE_ID constant
// pattern. That file additionally exports a large TRANSFORMATIONS content map; this skeleton
// keeps only the shape every module needs and a placeholder `config` object for whatever
// module-specific constants your scaffold ends up needing.

export const MODULE_ID = "tristons-world-map";

// Add module-specific constants here as your module grows (lookup tables, default settings
// values, socket channel names, etc.) — keep this file free of any `game`/`foundry`/`Hooks`
// reference so it stays trivially unit-testable per docs/testing-foundry-logic.md ("pure core").
export const config = {
  moduleId: MODULE_ID
};
