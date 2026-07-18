// Generalized from tristons-transformations tools/release.mjs:1-25
// (Grim Hollow/Tooling/tristons-transformations/tools/release.mjs, also quoted in full at
// docs/release-and-deploy.md "Private path" step 3) — staging compilePack + python-zip.
// NOT a verbatim copy: the output zip filename deliberately deviates from the exemplar
// (adds a `v` prefix) — see the comment above `const out` below for why.
// Per spec amendment #2 (docs/superpowers/specs/2026-07-14-foundry-module-master-design.md
// "Post-mining amendments" item 2): loot-gen has NO release/build script of its own (verified
// negative), so this file derives from transformations only. There is no public-path
// equivalent to draw from either exemplar — see docs/release-and-deploy.md "Public path" step 4.
//
// PACKS is preset-dependent: transformations compiles 3 named packs from packs-src/<name> into
// staging/packs/<name>. A scaffold with no content-pack preset ships zero packs, so this
// defaults to an empty array and the compile loop below is a no-op for that case — a
// content-pack-preset overlay (Task 4+) fills PACKS in for modules that do ship packs.

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const MODULE_ID = "tristons-world-map";

// Preset-dependent: list of pack directory names under packs-src/ this module ships.
// Leave empty for a module with no compendium-pack preset (release still zips cleanly,
// just skips the compile step and the empty staging/packs/ dir).
const PACKS = [];

const manifest = JSON.parse(readFileSync("module.json", "utf8"));
const staging = "release/staging";
rmSync("release", { recursive: true, force: true });
mkdirSync(join(staging, "packs"), { recursive: true });

// transformations' own list hard-codes "templates" (Handlebars partials for its sheet tab);
// the base scaffold ships no templates/ dir, so it's included conditionally — if a preset
// overlay (or later work) adds templates/*.hbs, the release picks them up automatically
// instead of silently shipping a zip whose partials would 404 at runtime.
const parts = ["module.json", "README.md", "scripts", "styles", "lang"];
if (existsSync("templates")) parts.push("templates");
for (const part of parts) {
  cpSync(part, join(staging, part), { recursive: true });
}
// lang/README.md is template-authoring guidance, not module content — keep it out of the zip.
rmSync(join(staging, "lang", "README.md"), { force: true });

if (PACKS.length === 0) {
  console.log("no packs configured (PACKS is empty) — skipping compilePack step");
} else {
  for (const pack of PACKS) {
    await compilePack(`packs-src/${pack}`, join(staging, "packs", pack), { recursive: true });
    console.log(`compiled ${pack} into staging`);
  }
}

// DELIBERATE DEVIATION from the transformations exemplar (which emits
// `${MODULE_ID}-${version}.zip`, no `v` — it only ever shipped private, where the filename
// doesn't matter): the `v` prefix makes the built zip's name match module.public.json's
// `download` URL basename (`tristons-world-map-v0.1.0.zip`, loot-gen's settled dist
// convention — docs/release-and-deploy.md "Public path" step 3) exactly, so the asset
// `gh release create` publishes is the one Foundry's auto-update fetch resolves. Private
// path is unaffected by the name.
const out = `release/${MODULE_ID}-v${manifest.version}.zip`;
execSync(
  `python -c "import shutil; shutil.make_archive(r'${out.replace(/\.zip$/, "")}', 'zip', r'${staging}')"`,
  { stdio: "inherit" }
);
rmSync(staging, { recursive: true, force: true });
console.log(`built ${out}`);
