import type { Mesh, Vector3 } from 'three';
import type { ComponentMap, Entity, Scene, System } from './aframe';

export interface RoomData {
  outside: boolean;
  height: number;
  width: number;
  length: number;
}

export interface WallData {
  height: number;
  uvScale: number;
}

export interface PortalData {
  from: OpeningEl | null;
  to: OpeningEl | null;
  height: number;
  width: number;
  floorHeight: number;
}

export interface SurfaceData {
  uvScale: number;
}

export type SurfaceType = 'floor' | 'ceiling' | 'sides';

interface ComponentDataMap extends Record<SurfaceType, SurfaceData> {
  room: RoomData;
  wall: WallData;
  portal: PortalData;
}

export interface BuildingSystem extends System<BuildingScene> {
  buildPending: boolean;
  dirtyPortals: Set<PortalEl>;
  dirtyRooms: Set<RoomEl>;
  buildRoom(roomEl: RoomEl): void;
  buildPortal(portalEl: PortalEl): void;
  requestBuild(): void;
}

export interface BuildingScene extends Scene {
  systems: { building?: BuildingSystem };
}

// Any element in a room hierarchy: reads component data by name and may own a generated mesh.
export interface BuildingEl extends Entity {
  sceneEl: BuildingScene;
  components: ComponentMap & { portal?: { data: PortalData } };
  mesh?: Mesh | null;
  getAttribute<K extends keyof ComponentDataMap>(name: K): ComponentDataMap[K];
  getAttribute(name: string): string | null;
}

export interface RoomEl extends BuildingEl {
  walls: WallEl[];
  floor: BuildingEl | null;
  ceiling: BuildingEl | null;
}

export interface WallEl extends BuildingEl {
  parentEl: RoomEl;
  openings: OpeningEl[];
  nextWallEl?: WallEl;
  getHeight(): number;
}

export interface OpeningEl extends BuildingEl {
  parentEl: WallEl;
  vertices: Vector3[];
  _portalEl?: PortalEl | null;
  getPortal(): PortalEl | null;
}

export interface PortalEl extends BuildingEl {
  children: HTMLCollectionOf<BuildingEl>;
}
