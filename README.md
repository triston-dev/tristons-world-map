<!-- Module-README skeleton, assembled per docs/module-anatomy.md and docs/release-and-deploy.md,
     structure modeled on tristons-transformations README.md:1-45 (Grim Hollow/Tooling/tristons-transformations/README.md)
     — title, Requirements, Installation, Usage, (Content attribution if applicable) sections. -->

# Triston's World Map

Turn any scene into a living world map: pins with discovery states, travel paths and history trails, party tracking, region-based random encounters, automated party-wide perception checks, weather, supplies, and an auto-generated travel chronicle.

## Requirements

- Foundry VTT **v13** (verified on 13.351)
- The **dnd5e** system, **v5.2 or later** (verified on 5.3.3)

## Installation

In Foundry's **Setup → Add-on Modules → Install Module**, paste this manifest URL and install:

```
https://github.com/triston-dev/tristons-world-map/releases/latest/download/module.json
```

Alternatively, download a release zip from the
[releases page](https://github.com/triston-dev/tristons-world-map/releases) and extract it into
`Data/modules/tristons-world-map/`.

## Usage

<!-- Describe what the module actually does once it does something. -->

## Development

- `npm install` — installs `@foundryvtt/foundryvtt-cli` (only devDependency).
- `npm test` — runs `node --test` over `tools/tests/**/*.test.mjs`.
- `npm run release` — builds `release/tristons-world-map-<version>.zip` via `tools/release.mjs`.

See this module's own `CLAUDE.md` for house working rules, and the Foundry Module Master repo's
`docs/` playbooks for the conventions this scaffold follows.
