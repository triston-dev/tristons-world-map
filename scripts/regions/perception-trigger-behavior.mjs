// Custom RegionBehavior sub-type: a perception trigger. When the party's travel day-tick
// passes through the region, every party member rolls (or passively checks) Perception vs
// the DC; success reveals the linked hidden pin (scripts/core/day-events.mjs).

const { RegionBehaviorType } = foundry.data.regionBehaviors;
const fields = foundry.data.fields;

export class PerceptionTriggerBehavior extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["TWM.PerceptionTrigger"];

  static defineSchema() {
    return {
      dc: new fields.NumberField({ required: true, initial: 15, min: 1, max: 40, step: 1 }),
      mode: new fields.StringField({
        required: true,
        initial: "passive",
        choices: {
          passive: "TWM.PerceptionTrigger.ModePassive",
          active: "TWM.PerceptionTrigger.ModeActive"
        }
      }),
      linkedPinId: new fields.StringField({ required: false, initial: "" }),
      once: new fields.BooleanField({ initial: true }),
      revealMessage: new fields.StringField({ required: false, initial: "" })
    };
  }
}
