// Custom RegionBehavior sub-type: an encounter zone. Attach to a native Scene Region via the
// region config UI. The travel day-tick point-tests the party position against regions and
// rolls each hit zone's encounter chance (scripts/core/day-events.mjs).
//
// Sub-typing RegionBehavior was live-verified on 13.351/dnd5e 5.3.3 (Phase 4 spike):
// RegionBehavior.hasTypeData === true; dnd5e itself registers "dnd5e.difficultTerrain" the
// same way. Registration: CONFIG.RegionBehavior.dataModels + module.json documentTypes.

const { RegionBehaviorType } = foundry.data.regionBehaviors;
const fields = foundry.data.fields;

export class EncounterZoneBehavior extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["TWM.EncounterZone"];

  static defineSchema() {
    return {
      tableUuid: new fields.DocumentUUIDField({ type: "RollTable" }),
      chancePerDay: new fields.NumberField({
        required: true, initial: 0.25, min: 0, max: 1, step: 0.05
      }),
      terrainMult: new fields.NumberField({
        required: true, initial: 1, min: 0.1, max: 4, step: 0.1
      }),
      label: new fields.StringField({ required: false, initial: "" })
    };
  }
}
