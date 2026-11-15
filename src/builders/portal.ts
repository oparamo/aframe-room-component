import type { Material, Vector3 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, BuildState, PortalEl } from '../types/elements';
import type { OpeningCorners, SurfaceType } from '../types/geometry';
import { surfaceCorners, surfaceGeometry } from '../geometry/surfaces';
import { applyMesh, getMaterial, removeMesh } from './helpers/mesh';
import { dataOf, isEntity, isOpening, nameOf } from './helpers/structure';

interface PortalSurfaceContext {
  from: OpeningCorners;
  to: OpeningCorners;
  // The room the from opening is in, whose floor and ceiling pattern the portal's continue.
  fromRoomEl: Entity;
  fallbackMaterial: Material | undefined;
}

const CHILD_TYPES: SurfaceType[] = ['sides', 'floor', 'ceiling'];

const toChildLocal = (vertex: Vector3, childEl: Entity) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  return [point.x, point.y, point.z];
};

// The portal's floor, ceiling and sides children, each with the surface it makes.
const surfacesOf = (portalEl: PortalEl) => [...portalEl.children].filter(isEntity).flatMap((childEl) => {
  const type = CHILD_TYPES.find(t => childEl.components[t]);
  if (!type) return [];
  return [{ childEl, type }];
});

const buildPortalSurface = (childEl: BuildingEl, type: SurfaceType, context: PortalSurfaceContext) => {
  const corners = surfaceCorners(type, context.from, context.to);
  const positions = corners.flatMap(vertex => toChildLocal(vertex, childEl));
  const roomCorners = corners.map(vertex => context.fromRoomEl.object3D.worldToLocal(vertex.clone()));
  const { uvScale } = dataOf(childEl, type);
  const geom = surfaceGeometry({ type, roomCorners, positions, uvScale });
  applyMesh({ el: childEl, geom, fallbackMaterial: context.fallbackMaterial });
};

interface PortalEnd { end: 'from' | 'to'; el: Entity | null }

// Why an end can't be joined, or null when it can.
const endProblem = ({ end, el }: PortalEnd, { cornersOf }: BuildState) => {
  if (!el) return `${end} matches no element`;
  if (!isOpening(el)) return `${end} is ${nameOf(el)}, not an <a-opening>`;
  if (!cornersOf.has(el)) return `the ${end} opening's room hasn't been built`;
  return null;
};

// The corners the end's opening recorded, or null after logging why there are none.
const endCorners = (portalEl: PortalEl, portalEnd: PortalEnd, state: BuildState) => {
  const problem = endProblem(portalEnd, state);
  if (problem) console.error(`${nameOf(portalEl)} was not built: ${problem}.`, portalEl);
  if (!isOpening(portalEnd.el)) return null;
  return state.cornersOf.get(portalEnd.el) ?? null;
};

// Logs each end whose opening its room couldn't cut, and says whether there was one. Both rooms then
// keep a solid wall, so the other end's missing corners need no message of their own.
const reportOpeningProblems = (portalEl: PortalEl, ends: PortalEnd[], { problemOf }: BuildState) => {
  const problems = ends.flatMap(({ end, el }) => {
    const problem = isOpening(el) && problemOf.get(el);
    if (!problem) return [];
    return [`the ${end} opening ${problem}`];
  });
  for (const problem of problems) console.error(`${nameOf(portalEl)} was not built: ${problem}.`, portalEl);
  return problems.length > 0;
};

const removeSurfaces = (portalEl: PortalEl) => {
  for (const { childEl } of surfacesOf(portalEl)) removeMesh(childEl);
};

const buildPortal = (portalEl: PortalEl, state: BuildState) => {
  const data = dataOf(portalEl, 'portal');
  const fromEnd: PortalEnd = { end: 'from', el: data.from };
  const toEnd: PortalEnd = { end: 'to', el: data.to };
  if (reportOpeningProblems(portalEl, [fromEnd, toEnd], state)) {
    removeSurfaces(portalEl);
    return;
  }

  const from = endCorners(portalEl, fromEnd, state);
  const to = endCorners(portalEl, toEnd, state);
  if (!from || !to || !isOpening(data.from)) {
    removeSurfaces(portalEl);
    return;
  }

  const fromWallEl = data.from.parentEl;
  const fallbackMaterial = getMaterial(fromWallEl) ?? getMaterial(fromWallEl.parentEl);
  const context = { from, to, fromRoomEl: fromWallEl.parentEl, fallbackMaterial };

  for (const { childEl, type } of surfacesOf(portalEl)) buildPortalSurface(childEl, type, context);
};

export { buildPortal };
