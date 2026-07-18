// The travel-day event pipeline: subscribes to the travelDay hook fired by travel-service
// and runs (in order) encounter zones then perception triggers for every region the day's
// movement crossed. GM-client-only by construction (travelDays only runs on the GM client).
//
// Phase 6 adds weather + supplies to this same pipeline.

import { MODULE_ID } from "../config.mjs";
import { regionsOnPath, moduleBehaviors } from "./region-query.mjs";
import { partyPerceptionCheck } from "./perception-service.mjs";
import { getPin, updatePin } from "./store.mjs";
import { revealChanges } from "./discovery.mjs";

export function registerDayEvents() {
  Hooks.on(`${MODULE_ID}.travelDay`, onTravelDay);
}

async function onTravelDay(context) {
  if (!game.user.isGM) return;
  const { scene, from, to, day } = context;
  const regions = regionsOnPath(scene, from, to);
  for (const region of regions) {
    for (const behavior of moduleBehaviors(region, "encounterZone")) {
      await runEncounterZone(scene, region, behavior, day);
    }
  }
  for (const region of regions) {
    for (const behavior of moduleBehaviors(region, "perceptionTrigger")) {
      await runPerceptionTrigger(scene, region, behavior, day);
    }
  }
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

async function runEncounterZone(scene, region, behavior, day) {
  const { tableUuid, chancePerDay, label } = behavior.system;
  const chanceRoll = Math.random();
  if (chanceRoll >= (chancePerDay ?? 0)) return;

  const table = tableUuid ? await fromUuid(tableUuid) : null;
  let resultText = null;
  let draw = null;
  if (table) {
    draw = await table.draw({ displayChat: false });
    resultText = draw.results.map((r) => r.description ?? r.text ?? r.name ?? "").join(", ");
  }

  const zoneName = label || region.name;
  const fire = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("TWM.Encounters.PromptTitle") },
    content: `
      <p><strong>${game.i18n.format("TWM.Encounters.PromptHeader", { zone: foundry.utils.escapeHTML(zoneName), day })}</strong></p>
      ${resultText
        ? `<p>${resultText}</p>`
        : `<p class="twm-empty">${game.i18n.localize("TWM.Encounters.NoTable")}</p>`}
    `,
    yes: { label: game.i18n.localize("TWM.Encounters.Fire"), icon: "fas fa-bolt" },
    no: { label: game.i18n.localize("TWM.Encounters.Skip"), icon: "fas fa-forward" }
  });
  if (!fire) return;

  if (draw && table) {
    // Re-post the SAME drawn results publicly (no re-draw).
    await ChatMessage.create({
      content: `<strong>${game.i18n.format("TWM.Encounters.ChatHeader", { zone: foundry.utils.escapeHTML(zoneName) })}</strong><br>${resultText}`
    });
  } else {
    await ChatMessage.create({
      content: game.i18n.format("TWM.Encounters.ChatHeaderNoTable", { zone: foundry.utils.escapeHTML(zoneName) })
    });
  }
}

// ---------------------------------------------------------------------------
// Perception triggers
// ---------------------------------------------------------------------------

async function runPerceptionTrigger(scene, region, behavior, day) {
  const { dc, mode, linkedPinId, once, revealMessage } = behavior.system;
  const { results, anySuccess } = await partyPerceptionCheck(dc, mode);

  // GM breakdown (whispered).
  const rows = results.map((r) =>
    `<tr><td>${foundry.utils.escapeHTML(r.name)}</td><td>${r.value}</td><td>${r.success ? "✓" : "✗"}</td></tr>`).join("");
  await ChatMessage.create({
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    content: `
      <strong>${game.i18n.format("TWM.Perception.GmHeader", { region: foundry.utils.escapeHTML(region.name), dc, mode })}</strong>
      <table><tbody>${rows}</tbody></table>
    `
  });

  if (anySuccess) {
    if (linkedPinId) {
      const pin = getPin(scene, linkedPinId);
      const changes = pin ? revealChanges(pin, day) : null;
      if (changes) {
        await updatePin(scene, linkedPinId, changes);
        await ChatMessage.create({
          content: game.i18n.format("TWM.Perception.Revealed", {
            name: foundry.utils.escapeHTML(pin.name || game.i18n.localize("TWM.Pins.Unnamed"))
          })
        });
      }
    }
    if (revealMessage) {
      await ChatMessage.create({ content: foundry.utils.escapeHTML(revealMessage) });
    }
    if (once) await behavior.update({ disabled: true });
  }
}
