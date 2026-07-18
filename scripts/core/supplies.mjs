// Ration tracking: consume per party member per travel day, warn at a threshold. Pure.

/**
 * @param {{rations:number, perMemberPerDay:number, warnAt:number}} supplies
 * @param {number} partySize
 * @returns {{supplies, consumed:number, warning:boolean, empty:boolean}}
 */
export function consumeSupplies(supplies, partySize) {
  const perMember = Number(supplies?.perMemberPerDay ?? 1);
  const consumed = Math.max(0, perMember * partySize);
  const before = Number(supplies?.rations ?? 0);
  const rations = Math.max(0, before - consumed);
  const warnAt = Number(supplies?.warnAt ?? 0);
  return {
    supplies: { ...supplies, rations },
    consumed,
    warning: rations > 0 && rations <= warnAt && before > warnAt,
    empty: rations <= 0 && before > 0
  };
}

/** Whether supply tracking is configured at all. Pure. */
export function suppliesEnabled(supplies) {
  return Number(supplies?.rations ?? -1) >= 0 && Number(supplies?.perMemberPerDay ?? 0) > 0;
}
