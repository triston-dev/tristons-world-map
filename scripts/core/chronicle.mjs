// The travel chronicle: an auto-maintained JournalEntry logging each travel day (distance,
// weather, encounters, discoveries, supplies). buildDayHtml is pure (unit-tested); the
// journal I/O wrapper is Foundry-facing and GM-only.

import { MODULE_ID } from "../config.mjs";
import { getMapFlags } from "./store.mjs";

/**
 * Pure. One day's chronicle block from the day context + collected event strings.
 * @param {{day:number, units:number, unitLabel:string}} info
 * @param {string[]} events   already-localized, plain-text event lines
 */
export function buildDayHtml(info, events) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = (events ?? []).map((e) => `<li>${esc(e)}</li>`).join("");
  return [
    `<h3>Day ${Number(info.day)}</h3>`,
    `<p>Traveled ${Number(info.units)} ${esc(info.unitLabel)}.</p>`,
    lines ? `<ul>${lines}</ul>` : ""
  ].filter(Boolean).join("\n");
}

/** Append a day block to the scene's chronicle journal, creating journal + page on demand. */
export async function appendChronicle(scene, info, events) {
  const flags = getMapFlags(scene);
  let journal = flags.chronicleJournalUuid ? await fromUuid(flags.chronicleJournalUuid) : null;
  if (!journal) {
    journal = await JournalEntry.create({
      name: game.i18n.format("TWM.Chronicle.JournalName", { scene: scene.name })
    });
    await scene.update({ [`flags.${MODULE_ID}.chronicleJournalUuid`]: journal.uuid });
  }
  let page = journal.pages.contents.find((p) => p.type === "text");
  const block = buildDayHtml(info, events);
  if (!page) {
    await journal.createEmbeddedDocuments("JournalEntryPage", [{
      name: game.i18n.localize("TWM.Chronicle.PageName"),
      type: "text",
      text: { content: block, format: 1 }
    }]);
    return journal;
  }
  await page.update({ "text.content": `${page.text.content ?? ""}\n${block}` });
  return journal;
}
