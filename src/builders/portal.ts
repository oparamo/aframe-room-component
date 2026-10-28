import type { Material, Vector3 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, BuildState, PortalEl } from '../types/elements';
import type { OpeningCorners, SurfaceType } from '../types/geometry';
import { surfaceCorners, surfaceGeometry } from '../geometry/surfaces';
import { COLLIDABLE, WALKABLE } from '../utils/surfaceClasses';
import { applyMesh, getMaterial } from './helpers/mesh';
import { dataOf, isEntity, portalEnds } from './helpers/structure';

interface PortalSurfaceContext { from: OpeningCorners; to: OpeningCorners; fallbackMaterial: Material | undefined }

const CHILD_TYPES: SurfaceType[] = ['sides', 'floor', 'ceiling'];

// The player walks on a portal's floor and is stopped by its sides.
const SURFACE_CLASSES: Partial<Record<SurfaceType, string>> = { floor: WALKABLE, sides: COLLIDABLE };

const toChildLocal = (vertex: Vector3, childEl: Entity) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  return [point.x, point.y, point.z];
};

const buildPortalSurface = (childEl: BuildingEl, type: SurfaceType, { from, to, fallbackMaterial }: PortalSurfaceContext) => {
  const corners = surfaceCorners(type, from, to);
  const positions = corners.flatMap(vertex => toChildLocal(vertex, childEl));
  const { uvScale } = dataOf(childEl, type);
  applyMesh({ el: childEl, objectName: type, geom: surfaceGeometry({ type, corners, positions, uvScale }), fallbackMaterial });

  const className = SURFACE_CLASSES[type];
  if (className) childEl.classList.add(className);
};

// The corners both openings recorded, or null until both rooms have built them.
const endCorners = (portalEl: PortalEl, { cornersOf }: BuildState) => {
  const { from: fromEl, to: toEl } = portalEnds(dataOf(portalEl, 'portal'));
  const from = fromEl && cornersOf.get(fromEl);
  const to = toEl && cornersOf.get(toEl);
  if (!fromEl || !from || !to) return null;
  return { fromEl, from, to };
};

const buildPortal = (portalEl: PortalEl, state: BuildState) => {
  const ends = endCorners(portalEl, state);
  if (!ends) {
    const portalId = portalEl.id ? `#${portalEl.id}` : '<a-portal>';
    console.error(`${portalId}: opening vertices not found. Make sure both openings exist and their rooms have been built.`);
    return;
  }

  const { fromEl, from, to } = ends;
  const fromWallEl = fromEl.parentEl;
  const fallbackMaterial = getMaterial(fromWallEl) ?? getMaterial(fromWallEl.parentEl);

  for (const childEl of [...portalEl.children].filter(isEntity)) {
    const type = CHILD_TYPES.find(t => childEl.components[t]);
    if (type) buildPortalSurface(childEl, type, { from, to, fallbackMaterial });
  }
};

export { buildPortal };
