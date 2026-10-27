import type { Mesh, Vector3 } from 'three';
import type { ComponentMap, Entity, Scene, System } from './aframe';

interface RoomData {
  outside: boolean;
  height: number;
  width: number;
  length: number;
}

interface WallData {
  height: number;
  uvScale: number;
}

interface PortalData {
  from: OpeningEl | null;
  to: OpeningEl | null;
  height: number;
  width: number;
  floorHeight: number;
}

interface SurfaceData {
  uvScale: number;
}

type SurfaceType = 'floor' | 'ceiling' | 'sides';

interface ComponentDataMap extends Record<SurfaceType, SurfaceData> {
  room: RoomData;
  wall: WallData;
  portal: PortalData;
}

interface BuildingSystem extends System<BuildingScene> {
  buildPending: boolean;
  dirtyPortals: Set<PortalEl>;
  dirtyRooms: Set<RoomEl>;
  buildRoom(roomEl: RoomEl): void;
  buildPortal(portalEl: PortalEl): void;
  removeRoom(roomEl: RoomEl): void;
  removePortal(portalEl: PortalEl): void;
  requestBuild(): void;
}

interface BuildingScene extends Scene {
  systems: { building?: BuildingSystem };
}

// The public rebuild() of the room and portal components.
interface Rebuildable {
  rebuild(): void;
}

// Any element in a room hierarchy: reads component data by name and may own a generated mesh.
interface BuildingEl extends Entity {
  sceneEl: BuildingScene;
  parentEl: BuildingEl | null;
  components: ComponentMap & { room?: Rebuildable; portal?: Rebuildable & { data: PortalData } };
  mesh?: Mesh | null;
  getAttribute<K extends keyof ComponentDataMap>(name: K): ComponentDataMap[K];
  getAttribute(name: string): string | null;
}

interface RoomEl extends BuildingEl {
  walls: WallEl[];
  floor: BuildingEl | null;
  ceiling: BuildingEl | null;
}

interface WallEl extends BuildingEl {
  parentEl: RoomEl;
  openings: OpeningEl[];
  // The wall's position as of its last build.
  builtPosition?: Vector3;
  getHeight(): number;
}

interface OpeningEl extends BuildingEl {
  parentEl: WallEl;
  vertices: Vector3[];
  getPortal(): PortalEl | null;
}

interface PortalEl extends BuildingEl {
  children: HTMLCollectionOf<BuildingEl>;
}

export type {
  BuildingEl,
  BuildingScene,
  BuildingSystem,
  OpeningEl,
  PortalData,
  PortalEl,
  RoomData,
  RoomEl,
  SurfaceData,
  SurfaceType,
  WallData,
  WallEl
};
