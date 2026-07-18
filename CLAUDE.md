<!-- Per-module CLAUDE.md skeleton, per Foundry Module Master's own CLAUDE.md folder-map entry
     ("templates/ — fill-in skeletons ... each citing its exemplar module") and the house-stack
     rule at Foundry Module Master/CLAUDE.md rule 2. -->

# CLAUDE.md — Triston's World Map

## House stack

- Plain ESM JavaScript, no build step or bundler.
- Tests: `node --test` over `tools/tests/**/*.test.mjs`, using `tools/tests/foundry-shim.mjs`
  for any code that touches `game`/`foundry`/`Hooks`/`ui` at call time. `CONFIG`/`CONST` are not
  mocked — code paths touching them need live verification instead, not a bigger shim.
- Release: `npm run release` → `tools/release.mjs` (staging `compilePack` + Python-zip). Fill in
  `PACKS` in that file if this module ships compendium packs.

## Release path

<!-- Fill in at scaffold time based on which module.json variant was kept: -->
- Deploy model: **public GitHub-manifest** (private manual-zip / public GitHub-manifest — see this
  repo's `module.json` for which variant is live).
- Private: hand the release zip to Triston for manual upload to Sqyre's `Data/modules/tristons-world-map/`.
- Public: bump `version`, bump the pinned `download` URL, tag `v<version>`, `gh release create`
  with the zip attached, leave `manifest` untouched (stable "latest" alias).

## Verify before ship

- `npm test` passes.
- If this module has a Sqyre-hosted or local-desktop Foundry to verify against, follow this
  repo's `docs/local-verification.md` procedure before calling a change done — automated tests
  never touch a real render pass or the CSS cascade.
- Never launch a local Foundry build for **campaign play** — only for isolated module
  dev-testing against a throwaway local world, per the topology rule in the parent
  Foundry Module Master `CLAUDE.md`.
