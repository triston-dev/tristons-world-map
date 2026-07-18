// Pure geometry + unit conversion for overland travel. No Foundry globals — fully covered by
// tools/tests/travel-math.test.mjs.

/** Euclidean distance between two {x,y} points, in canvas px. */
export function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Total length of a waypoint polyline, in px. */
export function routeLengthPx(waypoints) {
  let total = 0;
  for (let i = 1; i < (waypoints?.length ?? 0); i++) total += dist(waypoints[i - 1], waypoints[i]);
  return total;
}

/** Convert canvas px to map units (e.g. miles) given the scene grid size and scale. */
export function pxToUnits(px, gridPx, unitsPerGrid) {
  if (!gridPx || !unitsPerGrid) return 0;
  return (px / gridPx) * unitsPerGrid;
}

/** Inverse of pxToUnits. */
export function unitsToPx(units, gridPx, unitsPerGrid) {
  if (!unitsPerGrid) return 0;
  return (units / unitsPerGrid) * gridPx;
}

/**
 * Position at a given progress along a route.
 * @param {Array<{x,y}>} waypoints
 * @param {number} segmentIndex  index of the segment's START waypoint
 * @param {number} progressPx    px traveled into that segment
 */
export function positionAlong(waypoints, segmentIndex, progressPx) {
  if (!waypoints?.length) return { x: 0, y: 0 };
  if (segmentIndex >= waypoints.length - 1) return { ...waypoints[waypoints.length - 1] };
  const a = waypoints[segmentIndex];
  const b = waypoints[segmentIndex + 1];
  const len = dist(a, b);
  const t = len > 0 ? Math.min(1, progressPx / len) : 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Advance along a route by a px budget. Returns the new segment position, the actual px
 * traveled (may be less than the budget at route end), and whether the route is finished.
 */
export function advanceAlongRoute(waypoints, segmentIndex, progressPx, advancePx) {
  let seg = segmentIndex;
  let prog = progressPx;
  let remaining = Math.max(0, advancePx);
  let traveled = 0;

  while (remaining > 0 && seg < waypoints.length - 1) {
    const segLen = dist(waypoints[seg], waypoints[seg + 1]);
    const left = segLen - prog;
    if (remaining >= left) {
      traveled += left;
      remaining -= left;
      seg += 1;
      prog = 0;
    } else {
      prog += remaining;
      traveled += remaining;
      remaining = 0;
    }
  }

  const finished = seg >= waypoints.length - 1;
  const pos = positionAlong(waypoints, seg, prog);
  return { segmentIndex: seg, progressPx: prog, pos, traveledPx: traveled, finished };
}

/** Px remaining from a route position to the route's end. */
export function remainingPx(waypoints, segmentIndex, progressPx) {
  if (!waypoints?.length || segmentIndex >= waypoints.length - 1) return 0;
  let total = dist(waypoints[segmentIndex], waypoints[segmentIndex + 1]) - progressPx;
  for (let i = segmentIndex + 1; i < waypoints.length - 1; i++) {
    total += dist(waypoints[i], waypoints[i + 1]);
  }
  return Math.max(0, total);
}

/** Whole days needed to cover a distance at a per-day speed (same units both args). */
export function etaDays(remainingUnits, unitsPerDay) {
  if (!(unitsPerDay > 0)) return Infinity;
  if (remainingUnits <= 0) return 0;
  return Math.ceil(remainingUnits / unitsPerDay);
}
