// The travel-day event pipeline, called (and awaited) directly by travel-service for each
// day: encounters → perception → weather → supplies → chronicle. GM-client-only by
// construction. `Hooks.callAll("tristons-world-map.travelDay", context)` still fires first
// for third-party listeners; this module's own work is awaited, so dialogs and rolls finish
// before the chronicle entry is written.
//
// context.events collects localized plain-text lines for the chronicle.

import { MODULE_ID } from "../config.mjs";
import { regionsOnPath, moduleBehaviors } from "./region-query.mjs";
import { partyPerceptionCheck, getPartyActors } from "./perception-service.mjs";
import { getPin, updatePin, getMapConfig, getTravelState, updateTravelState } from "./store.mjs";
import { revealChanges } from "./discovery.mjs";
import { rollDefaultWeather, parseSpeedMult, weatherDisplayName } from "./weather.mjs";
import { consumeSupplies, suppliesEnabled } from "./supplies.mjs";
import { appendChronicle } from "./chronicle.mjs";

/** Run the full post-move pipeline for one travel day. */
export async function runDayPipeline(context) {
  if (!game.user.isGM) return;
  const { scene, from, to, day } = context;
  context.events ??= [];

  const regions = regionsOnPath(scene, from, to);
  for (const region of regions) {
    for (const behavior of moduleBehaviors(region, "encounterZone")) {
      await runEncounterZone(context, region, behavior);
    }
  }
  for (const region of regions) {
    for (const behavior of moduleBehaviors(region, "perceptionTrigger")) {
      await runPerceptionTrigger(context, region, behavior);
    }
  }

  await runWeather(context);
  await runSupplies(context);

  if (getMapConfig(scene).chronicleEnabled) {
    await appendChronicle(scene, {
      day,
      units: Math.round(context.moved.units * 10) / 10,
      unitLabel: getMapConfig(scene).unitLabel
    }, context.events);
  }
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

async function runEncounterZone(context, region, behavior) {
  const { scene, day } = context;
  const { tableUuid, chancePerDay, label } = behavior.system;
  if (Math.random() >= (chancePerDay ?? 0)) return;

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
    await ChatMessage.create({
      content: `<strong>${game.i18n.format("TWM.Encounters.ChatHeader", { zone: foundry.utils.escapeHTML(zoneName) })}</strong><br>${resultText}`
    });
    context.events.push(game.i18n.format("TWM.Chronicle.Encounter", {
      zone: zoneName, result: resultText.replace(/<[^>]+>/g, "")
    }));
  } else {
    await ChatMessage.create({
      content: game.i18n.format("TWM.Encounters.ChatHeaderNoTable", { zone: foundry.utils.escapeHTML(zoneName) })
    });
    context.events.push(game.i18n.format("TWM.Chronicle.EncounterNoTable", { zone: zoneName }));
  }
}

// ---------------------------------------------------------------------------
// Perception triggers
// ---------------------------------------------------------------------------

async function runPerceptionTrigger(context, region, behavior) {
  const { scene, day } = context;
  const { dc, mode, linkedPinId, once, revealMessage } = behavior.system;
  const { results, anySuccess } = await partyPerceptionCheck(dc, mode);

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
        const name = pin.name || game.i18n.localize("TWM.Pins.Unnamed");
        await ChatMessage.create({
          content: game.i18n.format("TWM.Perception.Revealed", { name: foundry.utils.escapeHTML(name) })
        });
        context.events.push(game.i18n.format("TWM.Chronicle.Discovered", { name }));
      }
    }
    if (revealMessage) {
      await ChatMessage.create({ content: foundry.utils.escapeHTML(revealMessage) });
    }
    if (once) await behavior.update({ disabled: true });
  }
}

// ---------------------------------------------------------------------------
// Weather (rolled after the move; applies to the NEXT day's speed)
// ---------------------------------------------------------------------------

async function runWeather(context) {
  const { scene } = context;
  const mapConfig = getMapConfig(scene);
  if (!mapConfig.weatherEnabled) return;

  let next;
  const table = mapConfig.climateTableUuid ? await fromUuid(mapConfig.climateTableUuid) : null;
  if (table) {
    const draw = await table.draw({ displayChat: false });
    const text = draw.results.map((r) => r.description ?? r.text ?? r.name ?? "").join(", ");
    next = { current: weatherDisplayName(text), speedMult: parseSpeedMult(text) };
  } else {
    next = rollDefaultWeather(Math.random());
  }

  const prev = getTravelState(scene).weather;
  await updateTravelState(scene, { weather: next });
  if (prev?.current !== next.current) {
    await ChatMessage.create({
      content: game.i18n.format("TWM.Weather.Changed", { weather: foundry.utils.escapeHTML(next.current) })
    });
    context.events.push(game.i18n.format("TWM.Chronicle.Weather", { weather: next.current }));
  }
}

// ---------------------------------------------------------------------------
// Supplies
// ---------------------------------------------------------------------------

async function runSupplies(context) {
  const { scene } = context;
  const supplies = getTravelState(scene).supplies;
  if (!suppliesEnabled(supplies)) return;

  const partySize = Math.max(1, getPartyActors().length);
  const result = consumeSupplies(supplies, partySize);
  await updateTravelState(scene, { supplies: result.supplies });

  if (result.empty) {
    await ChatMessage.create({
      content: game.i18n.localize("TWM.Supplies.Empty")
    });
    context.events.push(game.i18n.localize("TWM.Chronicle.SuppliesEmpty"));
  } else if (result.warning) {
    await ChatMessage.create({
      whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
      content: game.i18n.format("TWM.Supplies.Warning", { rations: result.supplies.rations })
    });
  }
}
