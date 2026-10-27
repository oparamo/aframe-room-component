import { vi } from 'vitest';
import type { Material, Vector3 } from 'three';
import type { AFrame, Entity } from '../../src/types/aframe';
import type { CollisionComponent } from '../../src/components/collision';
import type {
  BuildingEl, BuildingScene, BuildingSystem, OpeningEl, PortalEl, RoomEl, WallEl
} from '../../src/types/elements';

// Data shapes are checked a few levels down; deeper than that (and for functions) anything goes,
// which keeps DOM-sized types such as HTMLElement from blowing the compiler's depth limit.
type Fn = (...args: never[]) => unknown;
type DeepPartial<T, Depth extends unknown[] = []> = Depth['length'] extends 4 ? unknown
  : T extends Fn ? Fn
    : T extends object ? { [K in keyof T]?: DeepPartial<T[K], [...Depth, unknown]> } : T;

// Test doubles fill in only what the code under test reads. This is the one place they are
// asserted to the full type; DeepPartial still checks the property names and shapes they set.
const fake = <T>(partial: DeepPartial<T>): T => partial as unknown as T;

// --- A-Frame registry ---

const registry = {
  components: new Map<string, object>(),
  systems: new Map<string, object>(),
  primitives: new Map<string, object>()
};

const installAframeMock = () => {
  const aframe: AFrame = {
    registerComponent (name, definition) { registry.components.set(name, definition); },
    registerSystem (name, definition) { registry.systems.set(name, definition); },
    registerPrimitive (name, definition) { registry.primitives.set(name, definition); }
  };
  Object.assign(globalThis, { AFRAME: aframe });
};

const lookup = (kind: keyof typeof registry, name: string) => {
  const definition = registry[kind].get(name);
  if (!definition) throw new Error(`No ${kind} registered as "${name}".`);
  return definition;
};

// Component methods as the tests call them: with no arguments, since no component reads tick's.
// Only room and portal define rebuild.
interface Hooks {
  init(): void;
  update(): void;
  remove(): void;
  tick(): void;
  rebuild(): void;
}

const registeredComponent = (name: string) => lookup('components', name) as Hooks;
const registeredPrimitive = (name: string) => lookup('primitives', name);
const registeredSystem = (name: string) =>
  lookup('systems', name) as Partial<BuildingSystem> & { init(): void };

// --- Geometry fixtures ---

interface Object3DOptions { x?: number; y?: number; z?: number }

const makeObject3D = ({ x = 0, y = 0, z = 0 }: Object3DOptions = {}) => ({
  matrixWorld: new THREE.Matrix4(),
  updateWorldMatrix () {},
  position: {
    x,
    y,
    z,
    set (nx: number, ny: number, nz: number) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
    }
  },
  rotation: { y: 0 },
  add () {},
  localToWorld (v: Vector3) { return v; },
  worldToLocal (v: Vector3) { return v; },
  getWorldPosition (target: Vector3) {
    target.x = this.position.x;
    target.y = this.position.y;
    target.z = this.position.z;
    return target;
  }
});

interface CapOptions { parentMaterial?: Material | null }

const makeCap = ({ parentMaterial = null }: CapOptions = {}) => {
  const el = {
    mesh: null as BuildingEl['mesh'],
    components: {},
    classList: { add: () => {} },
    parentEl: { components: { material: { material: parentMaterial } } },
    getAttribute () { return { uvScale: 1 }; },
    setObject3D (_name: string, mesh: BuildingEl['mesh']) { el.mesh = mesh; }
  };
  return el as unknown as BuildingEl;
};

interface WallOptions { x?: number; y?: number; z?: number; height?: number; openings?: OpeningEl[] }

const makeWall = ({ x = 0, y = 0, z = 0, height = 3, openings = [] }: WallOptions = {}) => {
  const el = {
    object3D: makeObject3D({ x, y, z }),
    openings,
    getHeight () { return height; },
    getAttribute: (attr: string) => attr === 'wall' ? { height, uvScale: 1 } : null,
    components: {},
    parentEl: { components: {}, object3D: makeObject3D() },
    mesh: null as BuildingEl['mesh'],
    nextWallEl: null,
    classList: { add: () => {} },
    setObject3D (_name: string, mesh: BuildingEl['mesh']) { el.mesh = mesh; }
  };
  return el as unknown as WallEl;
};

interface RoomOptions { outside?: boolean; width?: number | null; length?: number | null }

const makeRoom = (walls: WallEl[], { outside = false, width = null, length = null }: RoomOptions = {}) => ({
  getAttribute (attr: string) {
    if (attr === 'room') return { outside, width, length };
    return null;
  },
  walls,
  floor: makeCap(),
  ceiling: makeCap(),
  object3D: { visible: false }
}) as unknown as RoomEl;

const makeSquareRoom = (opts?: RoomOptions) => makeRoom([
  makeWall(),
  makeWall({ x: 5 }),
  makeWall({ x: 5, z: 5 }),
  makeWall({ z: 5 })
], opts);

// Convenience for building system tests: builds a room with one wall per portal.
const makeRoomWithLinks = ({ portals = [] }: { portals?: (PortalEl | null)[] } = {}) =>
  makeRoom(portals.map(portalEl => makeWall({ openings: [makeOpening({ portalEl })] })));

const makeOpening = ({ portalEl = null }: { portalEl?: PortalEl | null } = {}) => ({
  object3D: makeObject3D(),
  vertices: [],
  mesh: null,
  classList: { add: () => {} },
  getPortal () { return portalEl; },
  parentEl: null,
  setObject3D () {}
}) as unknown as OpeningEl;

interface OpeningVertsOptions { x: number; width: number; height: number }

const makeOpeningVerts = ({ x, width, height }: OpeningVertsOptions) => [
  new THREE.Vector3(x - width / 2, 0, 0),
  new THREE.Vector3(x - width / 2, height, 0),
  new THREE.Vector3(x + width / 2, 0, 0),
  new THREE.Vector3(x + width / 2, height, 0)
];

interface TransformedRoomOptions {
  corners: [number, number][];
  position?: [number, number, number];
  rotationY?: number;
  scale?: [number, number, number];
  portalAt: [number, number, number];
  portalWidth?: number;
}

// A room whose object3D, walls and opening are real THREE.Object3Ds parented as A-Frame would, so
// the room's transform reaches the build. The first wall holds the opening, and the portal sits at a
// world point.
const makeTransformedRoom = ({
  corners, position = [0, 0, 0], rotationY = 0, scale = [1, 1, 1], portalAt, portalWidth = 1
}: TransformedRoomOptions) => {
  const roomObject3D = new THREE.Object3D();
  roomObject3D.position.set(...position);
  roomObject3D.rotation.y = rotationY;
  roomObject3D.scale.set(...scale);

  const portalObject3D = new THREE.Object3D();
  portalObject3D.position.set(...portalAt);
  const portalEl = fake<PortalEl>({
    object3D: portalObject3D,
    getAttribute: () => ({ width: portalWidth, height: 2, floorHeight: 0 })
  });
  const openingEl = makeOpening({ portalEl });

  const walls = corners.map(([x, z], i) => {
    const wallEl = makeWall({ x, z, openings: i === 0 ? [openingEl] : [] });
    const wallObject3D = new THREE.Object3D();
    wallObject3D.position.set(x, 0, z);
    roomObject3D.add(wallObject3D);
    return Object.assign(wallEl, { object3D: wallObject3D });
  });
  const roomEl = Object.assign(makeRoom(walls), { object3D: roomObject3D, components: {} });
  for (const wallEl of walls) Object.assign(wallEl, { parentEl: roomEl });
  return { roomEl, openingEl };
};

interface PortalChildOptions { type: string; uvScale?: number }

const makePortalChild = ({ type, uvScale = 1 }: PortalChildOptions) => {
  const el = {
    components: {
      [type]: {},
      material: { material: null }
    },
    parentEl: { components: {} },
    object3D: makeObject3D(),
    mesh: null as BuildingEl['mesh'],
    classList: { add: () => {} },
    getAttribute () { return { uvScale }; },
    setObject3D (_name: string, mesh: BuildingEl['mesh']) { el.mesh = mesh; }
  };
  return el as unknown as BuildingEl;
};

interface PortalOptions {
  fromVerts?: Vector3[] | null;
  toVerts?: Vector3[] | null;
  children?: BuildingEl[];
  roomA?: RoomEl;
  roomB?: RoomEl;
}

// Unified portal mock. Supports geometry tests via fromVerts/toVerts/children
// (getAttribute interface) and system tests via roomA/roomB (components.portal.data interface).
const makePortal = ({ fromVerts, toVerts, children, roomA, roomB }: PortalOptions = {}) => ({
  getAttribute (attr: string) {
    if (attr === 'portal') return { from: { vertices: fromVerts }, to: { vertices: toVerts }, floorHeight: 0 };
    return null;
  },
  components: {
    portal: {
      data: {
        from: roomA ? { parentEl: { parentEl: roomA } } : null,
        to: roomB ? { parentEl: { parentEl: roomB } } : null
      }
    }
  },
  children
}) as unknown as PortalEl;

const makeSystem = () => ({
  ...registeredSystem('building'),
  el: { emit: () => {}, object3D: { updateMatrixWorld: () => {} } },
  dirtyRooms: new Set(),
  dirtyPortals: new Set(),
  buildPending: false
}) as unknown as BuildingSystem;

// --- Component fixtures ---

interface SceneOptions {
  portals?: DeepPartial<PortalEl>[];
  systems?: DeepPartial<BuildingScene['systems']>;
}

const makeSceneEl = ({ portals = [], systems = {} }: SceneOptions = {}) => ({
  systems,
  querySelector: () => null,
  querySelectorAll: (sel: string) => sel === 'a-portal' ? portals : []
}) as unknown as BuildingScene;

// Listeners the element mock captured, keyed by event name.
interface ListenerLog { _listeners: Record<string, EventListener | undefined> }

interface ElOptions {
  tag?: string;
  parentTag?: string | null;
  parentAttrs?: Record<string, object>;
  parentComponents?: DeepPartial<BuildingEl['components']>;
  walls?: DeepPartial<WallEl>[];
  openings?: DeepPartial<OpeningEl>[];
  ceilingEl?: DeepPartial<BuildingEl> | null;
  floorEl?: DeepPartial<BuildingEl> | null;
  sceneEl?: BuildingScene | null;
  attrs?: Record<string, object>;
}

const makeEl = ({
  tag = 'a-entity',
  parentTag = null,
  parentAttrs = {},
  parentComponents = {},
  walls = [],
  openings = [],
  ceilingEl = null,
  floorEl = null,
  sceneEl = null,
  attrs = {}
}: ElOptions = {}) => {
  const el = {
    localName: tag,
    parentEl: parentTag
      ? { localName: parentTag, components: parentComponents, getAttribute: (a: string) => parentAttrs[a] ?? null }
      : null,
    object3D: makeObject3D(),
    sceneEl: sceneEl ?? makeSceneEl(),
    _listeners: {} as ListenerLog['_listeners'],
    addEventListener (event: string, cb: EventListener) { this._listeners[event] = cb; },
    removeEventListener () {},
    querySelector (sel: string) {
      if (sel === 'a-ceiling') return ceilingEl;
      if (sel === 'a-floor') return floorEl;
      return null;
    },
    querySelectorAll (sel: string) {
      if (sel === 'a-wall') return walls;
      if (sel === 'a-opening') return openings;
      return [];
    },
    getAttribute (a: string) { return attrs[a] ?? null; }
  };
  return el as unknown as BuildingEl & ListenerLog;
};

// Runs requestAnimationFrame callbacks synchronously, so a test can assert on the build they schedule.
const immediateAnimationFrame = () => vi.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 0;
});

// Fires the componentchanged listener the component registered, as A-Frame would.
const fireComponentChanged = (el: ListenerLog, name: string) => {
  const listener = el._listeners.componentchanged;
  if (!listener) throw new Error('No componentchanged listener registered.');
  listener(new CustomEvent('componentchanged', { detail: { name } }));
};

interface CollisionElOptions {
  position?: Vector3;
  cameraY?: number;
  wallCollidables?: DeepPartial<BuildingEl>[];
  floorCollidables?: DeepPartial<BuildingEl>[];
  childCamera?: boolean;
  // The scene finished loading before room-collision was added, so its loaded event never fires.
  sceneLoaded?: boolean;
}

const makeCollisionEl = ({
  position = new THREE.Vector3(),
  cameraY = 1.6,
  wallCollidables = [],
  floorCollidables = [],
  childCamera = false,
  sceneLoaded = false
}: CollisionElOptions = {}) => {
  const cameraObjEl = childCamera
    ? {
        object3D: {
          getWorldPosition: (target: Vector3) => target.set(position.x, cameraY, position.z)
        }
      }
    : null;

  return {
    object3D: {
      position,
      getWorldPosition: (target: Vector3) => target.copy(position)
    },
    querySelector: () => cameraObjEl,
    components: {},
    sceneEl: {
      hasLoaded: sceneLoaded,
      addEventListener (event: string, cb: () => void) { if (event === 'loaded' && !sceneLoaded) cb(); },
      removeEventListener () {},
      querySelectorAll: (sel: string) => sel === '.collidable' ? wallCollidables : floorCollidables
    }
  } as unknown as Entity;
};

const makeCollisionComponent = (el: Entity, data = { radius: 0.4 }) => {
  const comp = { ...registeredComponent('room-collision'), el, data } as unknown as CollisionComponent & Hooks;
  comp.init.call(comp);
  return comp;
};

interface CompOptions extends ElOptions { data?: object }

// A component instance as A-Frame builds it: the definition's methods plus el and data. init stores
// handlers such as _onTransformChanged on it.
type MockComp<El> = Hooks & {
  el: El & ListenerLog;
  data: object;
  _onTransformChanged?: EventListener;
};

interface CompTarget { name: string; tag: string; parentTag: string }

const makeComp = <El extends BuildingEl>({ name, tag, parentTag }: CompTarget, { data = {}, ...elOpts }: CompOptions = {}): MockComp<El> => ({
  ...registeredComponent(name),
  el: makeEl({ tag, parentTag, ...elOpts }) as El & ListenerLog,
  data
});

const makeRoomComp = (opts: CompOptions = {}) =>
  makeComp<RoomEl>({ name: 'room', tag: 'a-room', parentTag: 'a-scene' }, { walls: [{}, {}, {}], ...opts });
const makeWallComp = (opts?: CompOptions) => makeComp<WallEl>({ name: 'wall', tag: 'a-wall', parentTag: 'a-room' }, opts);
const makeOpeningComp = (opts?: CompOptions) =>
  makeComp<OpeningEl>({ name: 'opening', tag: 'a-opening', parentTag: 'a-wall' }, opts);
const makePortalComp = (opts?: CompOptions) =>
  makeComp<PortalEl>({ name: 'portal', tag: 'a-portal', parentTag: 'a-scene' }, opts);

export {
  fake,
  fireComponentChanged,
  immediateAnimationFrame,
  installAframeMock,
  makeCap,
  makeCollisionComponent,
  makeCollisionEl,
  makeEl,
  makeObject3D,
  makeOpening,
  makeOpeningComp,
  makeOpeningVerts,
  makePortal,
  makePortalChild,
  makePortalComp,
  makeRoom,
  makeRoomComp,
  makeRoomWithLinks,
  makeSceneEl,
  makeSquareRoom,
  makeSystem,
  makeTransformedRoom,
  makeWall,
  makeWallComp,
  registeredComponent,
  registeredPrimitive,
  registeredSystem
};
