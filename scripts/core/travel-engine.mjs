// The day-tick reducer: pure computation of one travel day. No Foundry globals, no I/O —
// the Foundry-facing driver (scripts/core/travel-service.mjs) reads state, calls tickDay,
// persists the result, and fires the per-day hook pipeline (encounters/weather/supplies/
// perception attach there in later phases). Covered by tools/tests/travel-engine.test.mjs.

import { advanceAlongRoute, positionAlong, remainingPx, pxToUnits, unitsToPx, etaDays } from "./travel-math.mjs";
import { getPaceSet, getPace } from "./pace.mjs";

/**
 * Compute one day of travel along the active route.
 *
 * @param {object} args
 * @param {object} args.travelState  current travel state (day, segmentIndex, progressPx, paceId, paceSetId, weather?)
 * @param {object} args.route        the active route ({waypoints})
 * @param {number} args.gridPx       scene grid size in px
 * @param {object} args.mapConfig    {distancePerGrid, unitLabel}
 * @param {Array}  args.paceSets     normalized pace sets
 * @returns {{travelState, moved: {from, to, px, units}, finished: boolean}}
 */
export function tickDay({ travelState, route, gridPx, mapConfig, paceSets }) {
  const paceSet = getPaceSet(paceSets, travelState.paceSetId);
  const pace = getPace(paceSet, travelState.paceId);
  const speedMult = travelState.weather?.speedMult ?? 1;
  const perDayPx = unitsToPx(pace.perDay * speedMult, gridPx, mapConfig.distancePerGrid);

  const from = positionAlong(route.waypoints, travelState.segmentIndex ?? 0, travelState.progressPx ?? 0);
  const adv = advanceAlongRoute(
    route.waypoints,
    travelState.segmentIndex ?? 0,
    travelState.progressPx ?? 0,
    perDayPx
  );

  const day = (travelState.day ?? 0) + 1;
  return {
    travelState: {
      ...travelState,
      day,
      segmentIndex: adv.segmentIndex,
      progressPx: adv.progressPx,
      marker: { x: Math.round(adv.pos.x), y: Math.round(adv.pos.y) }
    },
    moved: {
      from,
      to: adv.pos,
      px: adv.traveledPx,
      units: pxToUnits(adv.traveledPx, gridPx, mapConfig.distancePerGrid)
    },
    finished: adv.finished
  };
}

/** Remaining distance + ETA readout for a route position (for HUD/panel display). */
export function routeReadout({ travelState, route, gridPx, mapConfig, paceSets }) {
  const paceSet = getPaceSet(paceSets, travelState.paceSetId);
  const pace = getPace(paceSet, travelState.paceId);
  const speedMult = travelState.weather?.speedMult ?? 1;
  const remPx = remainingPx(route.waypoints, travelState.segmentIndex ?? 0, travelState.progressPx ?? 0);
  const remUnits = pxToUnits(remPx, gridPx, mapConfig.distancePerGrid);
  return {
    remainingUnits: remUnits,
    unitLabel: paceSet.unitLabel,
    timeLabel: paceSet.timeLabel,
    perDay: pace.perDay * speedMult,
    eta: etaDays(remUnits, pace.perDay * speedMult)
  };
}
