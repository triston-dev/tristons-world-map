// Draws routes (planned/proposed/active), the travel history trail, and the in-progress
// route draft into the layer's containers. Pure PIXI.Graphics; restyled on every refresh.

import { ROUTE_STATUS } from "../config.mjs";

const STYLES = {
  [ROUTE_STATUS.PLANNED]:  { color: 0x4a90d9, alpha: 0.85, width: 4, dash: [14, 10] },
  [ROUTE_STATUS.PROPOSED]: { color: 0xb45ad9, alpha: 0.85, width: 4, dash: [6, 8] },
  [ROUTE_STATUS.ACTIVE]:   { color: 0x39c463, alpha: 0.95, width: 5, dash: null },
  [ROUTE_STATUS.DONE]:     { color: 0x808080, alpha: 0.4,  width: 3, dash: [4, 8] },
  trail:                   { color: 0xc4923a, alpha: 0.9,  width: 5, dash: null },
  draft:                   { color: 0xffffff, alpha: 0.7,  width: 2, dash: [4, 4] }
};

function drawPolyline(g, points, style) {
  if (points.length < 2) return;
  g.lineStyle({ width: style.width, color: style.color, alpha: style.alpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
  if (!style.dash) {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    return;
  }
  for (let i = 1; i < points.length; i++) dashedSegment(g, points[i - 1], points[i], style.dash);
}

function dashedSegment(g, a, b, [dashLen, gapLen]) {
  const total = Math.hypot(b.x - a.x, b.y - a.y);
  if (total <= 0) return;
  const ux = (b.x - a.x) / total;
  const uy = (b.y - a.y) / total;
  let t = 0;
  while (t < total) {
    const end = Math.min(t + dashLen, total);
    g.moveTo(a.x + ux * t, a.y + uy * t);
    g.lineTo(a.x + ux * end, a.y + uy * end);
    t = end + gapLen;
  }
}

function drawWaypointDots(g, waypoints, style) {
  for (const [i, w] of waypoints.entries()) {
    g.lineStyle(0);
    g.beginFill(style.color, Math.min(1, style.alpha + 0.1));
    g.drawCircle(w.x, w.y, i === 0 || i === waypoints.length - 1 ? 8 : 5);
    g.endFill();
  }
}

/**
 * Redraw all routes + draft into routeContainer.
 * @param {PIXI.Container} container
 * @param {object} routes         id → route
 * @param {Array|null} draft      in-progress waypoint list (GM route tool), or null
 */
export function renderRoutes(container, routes, draft = null) {
  container.removeChildren().forEach((c) => c.destroy());
  const g = new PIXI.Graphics();
  for (const route of Object.values(routes ?? {})) {
    const style = STYLES[route.status] ?? STYLES[ROUTE_STATUS.PLANNED];
    drawPolyline(g, route.waypoints, style);
    drawWaypointDots(g, route.waypoints, style);
  }
  if (draft?.length) {
    drawPolyline(g, draft, STYLES.draft);
    drawWaypointDots(g, draft, STYLES.draft);
  }
  container.addChild(g);
}

/** Redraw the history trail into trailContainer. */
export function renderTrail(container, trail) {
  container.removeChildren().forEach((c) => c.destroy());
  if (!trail?.length) return;
  const g = new PIXI.Graphics();
  const points = [trail[0].from, ...trail.map((t) => t.to)];
  drawPolyline(g, points, STYLES.trail);
  // Day ticks along the trail.
  g.lineStyle(0);
  for (const t of trail) {
    g.beginFill(STYLES.trail.color, 1);
    g.drawCircle(t.to.x, t.to.y, 4);
    g.endFill();
  }
  container.addChild(g);
}
