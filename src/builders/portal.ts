import type { Material, Vector3 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, BuildState, PortalEl } from '../types/elements';
import type { OpeningCorners, SurfaceType } from '../types/geometry';
import { surfaceCorners, surfaceGeometry } from '../geometry/surfaces';
import { COLLIDABLE, WALKABLE } from '../utils/surfaceClasses';
import { applyMesh, enableCollision, getMaterial, removeMesh } from './helpers/mesh';
import { dataOf, isEntity, isOpening, nameOf } from './helpers/structure';

interface PortalSurfaceContext { from: OpeningCorners; to: OpeningCorners; fallbackMaterial: Material | undefined }

const CHILD_TYPES: SurfaceType[] = ['sides', 'floor', 'ceiling'];

// The player walks on a portal's floor and is stopped by its sides.
const SURFACE_CLASSES: Partial<Record<SurfaceType, string>> = { floor: WALKABLE, sides: COLLIDABLE };

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

const buildPortalSurface = (childEl: BuildingEl, type: SurfaceType, { from, to, fallbackMaterial }: PortalSurfaceContext) => {
  const corners = surfaceCorners(type, from, to);
  const positions = corners.flatMap(vertex => toChildLocal(vertex, childEl));
  const { uvScale } = dataOf(childEl, type);
  applyMesh({ el: childEl, geom: surfaceGeometry({ type, corners, positions, uvScale }), fallbackMaterial });

  const className = SURFACE_CLASSES[type];
  if (className) enableCollision(childEl, className);
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

const buildPortal = (portalEl: PortalEl, state: BuildState) => {
  const data = dataOf(portalEl, 'portal');
  const from = endCorners(portalEl, { end: 'from', el: data.from }, state);
  const to = endCorners(portalEl, { end: 'to', el: data.to }, state);
  if (!from || !to || !isOpening(data.from)) {
    for (const { childEl } of surfacesOf(portalEl)) removeMesh(childEl);
    return;
  }

  const fromWallEl = data.from.parentEl;
  const fallbackMaterial = getMaterial(fromWallEl) ?? getMaterial(fromWallEl.parentEl);

  for (const { childEl, type } of surfacesOf(portalEl)) buildPortalSurface(childEl, type, { from, to, fallbackMaterial });
};

export { buildPortal };
