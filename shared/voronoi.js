/**
 * Weighted Voronoi (Power Diagram / Laguerre-Voronoi) Engine
 * Shared between client renderers and game logic.
 *
 * Each unit acts as a weighted seed. The bisector between two units i and j
 * is the radical plane:
 *   2(x_j - x_i)x + 2(y_j - y_i)y + (x_i^2 + y_i^2 - w_i) - (x_j^2 + y_j^2 - w_j) = 0
 *
 * Each cell is formed by iteratively clipping the map bounding box using
 * the Sutherland-Hodgman convex polygon clipping algorithm.
 */

export const MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 10,
  maxY: 10,
};

/**
 * Computes the territorial influence radius for a piece.
 * When uncontested, a unit commands a natural aura of this radius.
 * When contested with enemy units, the Power Diagram bisector partitions the overlap.
 */
export function getPieceInfluenceRadius(piece) {
  if (!piece) return 1.4;
  const power = Number(piece.power) || 2;
  const control = Number(piece.stats?.control ?? piece.control) || 0.1;
  const isLeader = piece.key && (piece.key.includes('Lord') || piece.key.includes('Tyrant'));
  
  // Base territorial influence radius in board units (tiles)
  let r = 1.0 + (power * 0.22) + (control * 0.4);
  if (isLeader) r += 0.8;
  if (piece.isVeteran) r += 0.3;
  return Math.max(0.8, Math.min(3.2, r));
}

/**
 * Creates an initial bounded circular polygon approximation for a unit's territorial influence.
 */
export function createBoundedPolygon(cx, cy, radius, numSides = 16, bounds = MAP_BOUNDS) {
  const poly = [];
  for (let i = 0; i < numSides; i++) {
    const angle = (i * 2 * Math.PI) / numSides;
    poly.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  let clipped = clipPolygonWithHalfPlane(poly, -1, 0, bounds.minX);
  clipped = clipPolygonWithHalfPlane(clipped, 1, 0, -bounds.maxX);
  clipped = clipPolygonWithHalfPlane(clipped, 0, -1, bounds.minY);
  clipped = clipPolygonWithHalfPlane(clipped, 0, 1, -bounds.maxY);
  return clipped;
}

/**
 * Computes the baseline territorial weight for a piece.
 */
export function getPieceTerritoryWeight(piece) {
  if (!piece) return 1.0;
  const power = Number(piece.power) || 2;
  const control = Number(piece.stats?.control ?? piece.control) || 0.1;
  const strength = Number(piece.strength ?? piece.stats?.strength) || 2;
  const isLeader = piece.key && (piece.key.includes('Lord') || piece.key.includes('Tyrant'));
  
  // Weight in normalized [0, 10] space (where tile spacing is 1.0)
  // Higher weight expands the unit's territorial boundary.
  const base = (power * 1.8) + (control * 4.0) + (strength * 0.4);
  const leaderBonus = isLeader ? 3.0 : 0.0;
  const veteranBonus = piece.isVeteran ? 1.5 : 0.0;

  return Math.max(0.2, base + leaderBonus + veteranBonus);
}

/**
 * Clips a convex polygon against a half-plane Ax + By + C <= 0
 * using the Sutherland-Hodgman algorithm.
 */
export function clipPolygonWithHalfPlane(poly, A, B, C) {
  if (!poly || poly.length < 3) return [];
  const out = [];
  const len = poly.length;

  for (let i = 0; i < len; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % len];

    const curDist = A * cur.x + B * cur.y + C;
    const nextDist = A * next.x + B * next.y + C;

    const curInside = curDist <= 1e-7;
    const nextInside = nextDist <= 1e-7;

    if (curInside) {
      out.push(cur);
      if (!nextInside) {
        // Exiting edge: compute intersection
        const t = curDist / (curDist - nextDist);
        out.push({
          x: cur.x + t * (next.x - cur.x),
          y: cur.y + t * (next.y - cur.y),
        });
      }
    } else if (nextInside) {
      // Entering edge: compute intersection
      const t = curDist / (curDist - nextDist);
      out.push({
        x: cur.x + t * (next.x - cur.x),
        y: cur.y + t * (next.y - cur.y),
      });
    }
  }

  return out;
}

/**
 * Computes the 2D surface area of a polygon via the Shoelace Formula.
 */
export function getPolygonArea(poly) {
  if (!poly || poly.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(area) * 0.5;
}

/**
 * Computes the centroid of a polygon.
 */
export function getPolygonCentroid(poly) {
  if (!poly || poly.length < 3) return null;
  let cx = 0, cy = 0, signedArea = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const x0 = poly[j].x, y0 = poly[j].y;
    const x1 = poly[i].x, y1 = poly[i].y;
    const a = x0 * y1 - x1 * y0;
    signedArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-7) return poly[0];
  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea),
  };
}

/**
 * Generates the complete Weighted Voronoi (Power Diagram) state.
 *
 * @param {Array} pieces - Array of live piece objects ({ id, team, col, row, ... })
 * @param {Object} bounds - Bounding box { minX, minY, maxX, maxY }
 * @returns {Object} { cells, frostArea, ashArea, frostShare, ashShare, frontlines }
 */
export function computePowerDiagram(pieces = [], bounds = MAP_BOUNDS) {
  const activePieces = pieces.filter(
    (p) => p && typeof p.col === 'number' && typeof p.row === 'number' && (p.currentHp === undefined || p.currentHp > 0)
  );

  // Map sites with coordinates, weights, and natural influence radii
  const sites = activePieces.map((p) => {
    // Offset slightly by +0.5 to center on coordinate tiles (0..10)
    const x = p.col + 0.5;
    const y = p.row + 0.5;
    const weight = getPieceTerritoryWeight(p);
    const radius = getPieceInfluenceRadius(p);
    const isLeader = p.isLeader || (p.key && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    const numSides = isLeader ? 24 : 16;
    return {
      piece: p,
      id: p.id,
      team: p.team,
      x,
      y,
      weight,
      radius,
      // Bounded territory: starts with an influence envelope around unit according to power
      polygon: createBoundedPolygon(x, y, radius, numSides, bounds),
    };
  });

  // Iteratively clip each site's polygon against other sites when influence regions overlap
  for (let i = 0; i < sites.length; i++) {
    const s1 = sites[i];
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const s2 = sites[j];

      const dx = s2.x - s1.x;
      const dy = s2.y - s1.y;
      const dist = Math.hypot(dx, dy);

      // If units are far apart, their influence envelopes don't overlap (uncontested)
      if (dist > s1.radius + s2.radius + 1.2) {
        continue;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq < 1e-9) {
        // Coincident points: heavier weight keeps the territory
        if (s1.weight < s2.weight) {
          s1.polygon = [];
          break;
        }
        continue;
      }

      // Half-plane parameters: 2(x2 - x1)x + 2(y2 - y1)y + (x1^2 + y1^2 - w1) - (x2^2 + y2^2 - w2) <= 0
      const A = 2 * dx;
      const B = 2 * dy;
      const C = (s1.x * s1.x + s1.y * s1.y - s1.weight) - (s2.x * s2.x + s2.y * s2.y - s2.weight);

      s1.polygon = clipPolygonWithHalfPlane(s1.polygon, A, B, C);
      if (s1.polygon.length < 3) {
        s1.polygon = [];
        break;
      }
    }
  }

  // Calculate areas and separate by faction
  let frostArea = 0;
  let ashArea = 0;

  const cells = sites.map((s) => {
    const area = getPolygonArea(s.polygon);
    if (s.team === 'snow') frostArea += area;
    else if (s.team === 'ash') ashArea += area;

    return {
      pieceId: s.id,
      piece: s.piece,
      team: s.team,
      center: { x: s.x, y: s.y },
      weight: s.weight,
      radius: s.radius,
      polygon: s.polygon,
      area,
      centroid: getPolygonCentroid(s.polygon),
    };
  });

  const totalMapArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY); // 100.0 tiles
  const frostShare = Number(frostArea.toFixed(1));
  const ashShare = Number(ashArea.toFixed(1));
  const neutralShare = Math.max(0, Number((totalMapArea - frostArea - ashArea).toFixed(1)));

  // Extract contested frontline edges (where a frost cell actually meets an ash cell in contested space)
  const frontlines = extractContestedFrontlines(cells);

  return {
    cells,
    frostArea,
    ashArea,
    totalArea: totalMapArea,
    frostShare,
    ashShare,
    neutralShare,
    frontlines,
  };
}

/**
 * Finds shared edges between opposing faction cells to render the dynamic clash boundary.
 */
function extractContestedFrontlines(cells) {
  const frontlines = [];
  const frostCells = cells.filter((c) => c.team === 'snow' && c.polygon.length >= 3);
  const ashCells = cells.filter((c) => c.team === 'ash' && c.polygon.length >= 3);

  // Helper to ensure bounding box on cell
  function getBBox(c) {
    if (c._bbox) return c._bbox;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const poly = c.polygon;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    c._bbox = { minX, maxX, minY, maxY };
    return c._bbox;
  }

  for (let i = 0; i < frostCells.length; i++) getBBox(frostCells[i]);
  for (let j = 0; j < ashCells.length; j++) getBBox(ashCells[j]);

  // Helper to test if a point lies on a line segment
  function isPointOnSegment(p, a, b, eps = 0.02) {
    const cross = Math.abs((p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y));
    if (cross > eps) return false;
    const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
    if (dot < -eps) return false;
    const lenSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
    if (dot > lenSq + eps) return false;
    return true;
  }

  // Helper to find segment overlap
  for (const fc of frostCells) {
    const fBBox = fc._bbox;
    const fPoly = fc.polygon;
    const fLen = fPoly.length;

    for (const ac of ashCells) {
      const aBBox = ac._bbox;
      // Fast AABB rejection: if cell bounding boxes don't touch within tolerance, skip edge comparisons
      if (
        fBBox.maxX < aBBox.minX - 0.05 ||
        fBBox.minX > aBBox.maxX + 0.05 ||
        fBBox.maxY < aBBox.minY - 0.05 ||
        fBBox.minY > aBBox.maxY + 0.05
      ) {
        continue;
      }

      const aPoly = ac.polygon;
      const aLen = aPoly.length;

      for (let fi = 0; fi < fLen; fi++) {
        const f1 = fPoly[fi];
        const f2 = fPoly[(fi + 1) % fLen];
        const fMinX = Math.min(f1.x, f2.x) - 0.02;
        const fMaxX = Math.max(f1.x, f2.x) + 0.02;
        const fMinY = Math.min(f1.y, f2.y) - 0.02;
        const fMaxY = Math.max(f1.y, f2.y) + 0.02;

        for (let ai = 0; ai < aLen; ai++) {
          const a1 = aPoly[ai];
          const a2 = aPoly[(ai + 1) % aLen];

          // Fast edge AABB rejection
          if (
            fMaxX < Math.min(a1.x, a2.x) ||
            fMinX > Math.max(a1.x, a2.x) ||
            fMaxY < Math.min(a1.y, a2.y) ||
            fMinY > Math.max(a1.y, a2.y)
          ) {
            continue;
          }

          // Check if segments are collinear and overlapping
          const p1InA = isPointOnSegment(f1, a1, a2);
          const p2InA = isPointOnSegment(f2, a1, a2);
          const a1InF = isPointOnSegment(a1, f1, f2);
          const a2InF = isPointOnSegment(a2, f1, f2);

          const collinear = (p1InA || p2InA || a1InF || a2InF);
          if (collinear) {
            // Find the overlapping endpoints
            const candidatePoints = [
              p1InA ? f1 : null,
              p2InA ? f2 : null,
              a1InF ? a1 : null,
              a2InF ? a2 : null,
            ].filter(Boolean);

            if (candidatePoints.length >= 2) {
              // Get the two furthest distinct points
              let maxD = 0;
              let bestPair = null;
              for (let m = 0; m < candidatePoints.length; m++) {
                for (let n = m + 1; n < candidatePoints.length; n++) {
                  const d = Math.hypot(
                    candidatePoints[m].x - candidatePoints[n].x,
                    candidatePoints[m].y - candidatePoints[n].y
                  );
                  if (d > maxD) {
                    maxD = d;
                    bestPair = [candidatePoints[m], candidatePoints[n]];
                  }
                }
              }

              if (bestPair && maxD > 0.08) {
                // Avoid duplicates
                const exists = frontlines.some(
                  (fl) =>
                    (Math.hypot(fl.p1.x - bestPair[0].x, fl.p1.y - bestPair[0].y) < 0.05 &&
                      Math.hypot(fl.p2.x - bestPair[1].x, fl.p2.y - bestPair[1].y) < 0.05) ||
                    (Math.hypot(fl.p1.x - bestPair[1].x, fl.p1.y - bestPair[1].y) < 0.05 &&
                      Math.hypot(fl.p2.x - bestPair[0].x, fl.p2.y - bestPair[0].y) < 0.05)
                );

                if (!exists) {
                  frontlines.push({
                    p1: bestPair[0],
                    p2: bestPair[1],
                    frostPieceId: fc.pieceId,
                    ashPieceId: ac.pieceId,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return frontlines;
}

export function isPointInPolygon(px, py, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Maps grid positions (r, c) to the owning faction based on the Voronoi power field.
 * Only positions covered by a unit's territorial envelope are occupied; unoccupied
 * terrain remains neutral.
 */
export function syncTerritorySetsFromVoronoi(gameState, voronoiData) {
  if (!gameState || !voronoiData || !voronoiData.cells) return;
  if (!(gameState.snowTerritory instanceof Set)) gameState.snowTerritory = new Set(Array.isArray(gameState.snowTerritory) ? gameState.snowTerritory : []);
  if (!(gameState.ashTerritory instanceof Set)) gameState.ashTerritory = new Set(Array.isArray(gameState.ashTerritory) ? gameState.ashTerritory : []);

  const activeCells = voronoiData.cells.filter(c => c.polygon && c.polygon.length >= 3);
  if (activeCells.length === 0) return;

  // Pre-calculate 2D bounding boxes to avoid expensive polygon ray-casting on distant cells
  const boundedCells = activeCells.map(cell => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p = 0; p < cell.polygon.length; p++) {
      const pt = cell.polygon[p];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { cell, minX, maxX, minY, maxY };
  });

  gameState.snowTerritory.clear();
  gameState.ashTerritory.clear();

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const px = c + 0.5;
      const py = r + 0.5;
      let bestTeam = null;
      let minPow = Infinity;

      for (let i = 0; i < boundedCells.length; i++) {
        const b = boundedCells[i];
        if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) {
          continue;
        }
        const cell = b.cell;
        if (isPointInPolygon(px, py, cell.polygon)) {
          const dx = px - cell.center.x;
          const dy = py - cell.center.y;
          const pow = (dx * dx + dy * dy) - cell.weight;
          if (pow < minPow) {
            minPow = pow;
            bestTeam = cell.team;
          }
        }
      }

      const key = `${r},${c}`;
      if (bestTeam === 'snow') {
        gameState.snowTerritory.add(key);
      } else if (bestTeam === 'ash') {
        gameState.ashTerritory.add(key);
      }
      // Unoccupied terrain is neither in snowTerritory nor in ashTerritory
    }
  }

  // Preserve and merge dynamic territory trails from unit movement
  if (Array.isArray(gameState.territoryTrails)) {
    for (let i = 0; i < gameState.territoryTrails.length; i++) {
      const tr = gameState.territoryTrails[i];
      const rad = Math.max(0.75, tr.radius || 1);
      const minR = Math.max(0, Math.floor(tr.row - rad));
      const maxR = Math.min(9, Math.ceil(tr.row + rad));
      const minC = Math.max(0, Math.floor(tr.col - rad));
      const maxC = Math.min(9, Math.ceil(tr.col + rad));
      for (let gr = minR; gr <= maxR; gr++) {
        for (let gc = minC; gc <= maxC; gc++) {
          const dx = gr - tr.row;
          const dy = gc - tr.col;
          if ((dx * dx + dy * dy) <= rad * rad) {
            const pos = `${gr},${gc}`;
            if (tr.team === 'snow') {
              gameState.snowTerritory.add(pos);
              gameState.ashTerritory.delete(pos);
            } else {
              gameState.ashTerritory.add(pos);
              gameState.snowTerritory.delete(pos);
            }
          }
        }
      }
    }
  }
}

