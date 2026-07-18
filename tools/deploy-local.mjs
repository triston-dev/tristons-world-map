// Copies the module's runtime files into the LOCAL desktop Foundry Data/modules dir for
// live verification (docs/local-verification.md). Never touches Sqyre. Usage: npm run deploy
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DEST = join(process.env.LOCALAPPDATA, "FoundryVTT", "Data", "modules", "tristons-world-map");
const ITEMS = ["scripts", "templates", "styles", "lang", "module.json"];

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const item of ITEMS) cpSync(item, join(DEST, item), { recursive: true });
console.log(`deployed ${ITEMS.length} items -> ${DEST}`);
