import type { Matrix4, Vector3 } from 'three';
import type { ComponentMap, Entity, Scene, System } from './aframe';
import type { OpeningCorners, SurfaceType } from './geometry';

interface RoomData {
  outside: boolean;
  height: number;
  width: number;
  length: number;
  passable: boolean;
}

interface WallData {
  height: number;
  uvScale: number;
  passable: boolean;
}

// from and to are whatever their selectors matched; the builders check for an a-opening.
interface PortalData {
  from: Entity | null;
  to: Entity | null;
  height: number;
  width: number;
  floorHeight: number;
}

interface SurfaceData {
  uvScale: number;
}

interface ComponentDataMap extends Record<SurfaceType, SurfaceData> {
  room: RoomData;
  wall: WallData;
  portal: PortalData;
}

// What the builders read and write between passes. The room-building system owns it.
interface BuildState {
  // The portal using each opening, kept current by the portal component.
  portalOf: WeakMap<OpeningEl, PortalEl>;
  // Each opening's world-space corners as of its room's last build, for its portal to join.
  cornersOf: WeakMap<OpeningEl, OpeningCorners>;
}

interface BuildingSystem extends System<BuildingScene> {
  buildPending: boolean;
  dirtyPortals: Set<PortalEl>;
  dirtyRooms: Set<RoomEl>;
  state: BuildState;
  // Rooms' and portals' world matrices, and walls' positions, as of their last build.
  builtMatrixOf: WeakMap<Entity, Matrix4>;
  builtPositionOf: WeakMap<WallEl, Vector3>;
  // Rooms the system hid until their first build.
  hiddenRooms: WeakSet<RoomEl>;
  tick(): void;
  hideUntilBuilt(roomEl: RoomEl): void;
  buildRoom(roomEl: RoomEl): void;
  buildPortal(portalEl: PortalEl): void;
  linkPortal(portalEl: PortalEl, previous: Partial<PortalData>): void;
  removeRoom(roomEl: RoomEl): void;
  removePortal(portalEl: PortalEl): void;
  removeOpening(openingEl: OpeningEl): void;
  requestBuild(): void;
  // el is a room or a portal.
  hasMoved(el: BuildingEl): boolean;
  hasWallMoved(wallEl: WallEl): boolean;
  _runPass(): void;
  _show(roomEl: RoomEl): void;
  _recordBuilt(rooms: RoomEl[], portals: PortalEl[]): void;
}

interface BuildingScene extends Scene {
  systems: { 'room-building'?: BuildingSystem };
}

// The public rebuild() of the room and portal components.
interface Rebuildable {
  rebuild(): void;
}

// Any element in a room hierarchy, reading component data by name.
interface BuildingEl extends Entity {
  sceneEl: BuildingScene;
  parentEl: BuildingEl | null;
  components: ComponentMap & { room?: Rebuildable; portal?: Rebuildable };
  getAttribute<K extends keyof ComponentDataMap>(name: K): ComponentDataMap[K] | null;
  getAttribute(name: string): string | null;
}

type RoomEl = BuildingEl;
type PortalEl = BuildingEl;

interface WallEl extends BuildingEl {
  parentEl: RoomEl;
}

interface OpeningEl extends BuildingEl {
  parentEl: WallEl;
}

export type {
  BuildingEl,
  BuildingScene,
  BuildingSystem,
  BuildState,
  ComponentDataMap,
  OpeningEl,
  PortalData,
  PortalEl,
  RoomData,
  RoomEl,
  SurfaceData,
  WallData,
  WallEl
};
