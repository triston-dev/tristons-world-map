# `lang/en.json` — placeholder guidance

JSON can't carry comments, so the `TWM` guidance that would normally live as a header
comment lives here instead (same precedent as `module.json.README.md` for the manifest variants).

`TWM` is the top-level localization-key namespace for your module — both exemplars use
a short all-caps abbreviation of the module name as this prefix: `tristons-transformations` uses
`"GHT"` (Grim Hollow Transformations; `Tooling/tristons-transformations/lang/en.json:2`),
`tristons-loot-generator` uses its own module-specific prefix following the same convention.

Pick a short, distinctive, all-caps abbreviation for your module, replace `TWM`
throughout `lang/en.json` with it, and reference the same prefix in `game.i18n.localize("<PREFIX>.Key")`
calls and settings-registration `name`/`hint` keys in `scripts/main.mjs`.

Delete the placeholder `Placeholder` key once real strings are added.
