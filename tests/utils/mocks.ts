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
export const fake = <T>(partial: DeepPartial<T>): T => partial as unknown as T;

// --- A-Frame registry ---

const registry = {
  components: new Map<string, object>(),
  systems: new Map<string, object>(),
  primitives: new Map<string, object>()
};

export const installAframeMock = () => {
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

// Lifecycle hooks as the tests call them: with no arguments, since no component reads tick's.
interface Hooks {
  init(): void;
  update(): void;
  remove(): void;
  tick(): void;
}

export const registeredComponent = (name: string) => lookup('components', name) as Hooks;
export const registeredPrimitive = (name: string) => lookup('primitives', name);
export const registeredSystem = (name: string) =>
  lookup('systems', name) as Partial<BuildingSystem> & { init(): void };

// --- Geometry fixtures ---

export const makeObject3D = (x = 0, y = 0, z = 0) => ({
  position: { x, y, z, set (nx: number, ny: number, nz: number) { this.x = nx; this.y = ny; this.z = nz; } },
  rotation: { y: 0 },
  add () {},
  localToWorld (v: Vector3) { return v; },
  worldToLocal (v: Vector3) { return v; },
  getWorldPosition (target: Vector3) { target.x = this.position.x; target.y = this.position.y; target.z = this.position.z; return target; }
});

export const makeCap = (parentMaterial: Material | null) => {
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

export const makeWall = (x = 0, z = 0, height = 3, openings: OpeningEl[] = [], y = 0) => {
  const el = {
    object3D: makeObject3D(x, y, z),
    openings,
    getHeight () { return height; },
    getAttribute (attr: string) { if (attr === 'wall') return { height, uvScale: 1 }; return null; },
    components: {},
    parentEl: { components: {} },
    mesh: null as BuildingEl['mesh'],
    nextWallEl: null,
    classList: { add: () => {} },
    setObject3D (_name: string, mesh: BuildingEl['mesh']) { el.mesh = mesh; }
  };
  return el as unknown as WallEl;
};

interface RoomOptions { outside?: boolean; width?: number | null; length?: number | null }

export const makeRoom = (walls: WallEl[], { outside = false, width = null, length = null }: RoomOptions = {}) => ({
  getAttribute (attr: string) {
    if (attr === 'room') return { outside, width, length };
    return null;
  },
  walls,
  floor: makeCap(null),
  ceiling: makeCap(null),
  object3D: { visible: false }
}) as unknown as RoomEl;

export const makeSquareRoom = (opts?: RoomOptions) => makeRoom([
  makeWall(0, 0),
  makeWall(5, 0),
  makeWall(5, 5),
  makeWall(0, 5)
], opts);

// Convenience for building system tests: builds a room with one wall per portal.
export const makeRoomWithLinks = (...portals: (PortalEl | null)[]) =>
  makeRoom(portals.map(p => makeWall(0, 0, 3, [makeOpening(p)])));

export const makeOpening = (portalEl: PortalEl | null) => ({
  object3D: makeObject3D(),
  vertices: [],
  mesh: null,
  classList: { add: () => {} },
  getPortal () { return portalEl; },
  parentEl: null,
  setObject3D () {}
}) as unknown as OpeningEl;

export const makeVertex = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const makeOpeningVerts = (x: number, width: number, height: number) => [
  makeVertex(x - width / 2, 0, 0),
  makeVertex(x - width / 2, height, 0),
  makeVertex(x + width / 2, 0, 0),
  makeVertex(x + width / 2, height, 0)
];

export const makePortalChild = (type: string) => {
  const el = {
    components: {
      [type]: {},
      material: { material: null }
    },
    parentEl: { components: {} },
    object3D: makeObject3D(),
    mesh: null as BuildingEl['mesh'],
    classList: { add: () => {} },
    getAttribute () { return { uvScale: 1 }; },
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
export const makePortal = ({ fromVerts, toVerts, children, roomA, roomB }: PortalOptions = {}) => ({
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

export const makeSystem = () => ({
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

export const makeSceneEl = ({ portals = [], systems = {} }: SceneOptions = {}) => fake<BuildingScene>({
  systems,
  querySelector: () => null,
  querySelectorAll: (sel: string) => sel === 'a-portal' ? portals : []
});

// Listeners the element mock captured, keyed by event name.
interface ListenerLog { _listeners: Record<string, EventListener | undefined> }

interface ElOptions {
  tag?: string;
  parentTag?: string | null;
  parentAttrs?: Record<string, object>;
  walls?: DeepPartial<WallEl>[];
  openings?: DeepPartial<OpeningEl>[];
  ceilingEl?: DeepPartial<BuildingEl> | null;
  floorEl?: DeepPartial<BuildingEl> | null;
  sceneEl?: BuildingScene | null;
  attrs?: Record<string, object>;
}

export const makeEl = <El extends BuildingEl = BuildingEl>({
  tag = 'a-entity',
  parentTag = null,
  parentAttrs = {},
  walls = [],
  openings = [],
  ceilingEl = null,
  floorEl = null,
  sceneEl = null,
  attrs = {}
}: ElOptions = {}) => {
  const el = {
    localName: tag,
    parentEl: parentTag ? { localName: parentTag, getAttribute: (a: string) => parentAttrs[a] ?? null } : null,
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
  return el as unknown as El & ListenerLog;
};

// Fires the componentchanged listener the component registered, as A-Frame would.
export const fireComponentChanged = (el: ListenerLog, name: string) => {
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
}

export const makeCollisionEl = ({
  position = new THREE.Vector3(),
  cameraY = 1.6,
  wallCollidables = [],
  floorCollidables = [],
  childCamera = false
}: CollisionElOptions = {}) => {
  const cameraObjEl = childCamera ? {
    object3D: {
      getWorldPosition (target: Vector3) { target.set(position.x, cameraY, position.z); return target; }
    }
  } : null;

  return {
    object3D: {
      position,
      getWorldPosition (target: Vector3) { target.copy(position); return target; }
    },
    querySelector: () => cameraObjEl,
    components: {},
    sceneEl: {
      addEventListener (event: string, cb: () => void) { if (event === 'loaded') cb(); },
      removeEventListener () {},
      querySelectorAll: (sel: string) => sel === '.collidable' ? wallCollidables : floorCollidables
    }
  } as unknown as Entity;
};

export const makeCollisionComponent = (el: Entity, data = { radius: 0.4 }) => {
  const comp = { ...registeredComponent('room-collision'), el, data } as unknown as CollisionComponent & Hooks;
  comp.init.call(comp);
  return comp;
};

interface CompOptions extends ElOptions { data?: object }

// A component instance as A-Frame builds it; init stores handlers such as _onTransformChanged on it.
interface MockComp<El> {
  el: El & ListenerLog;
  data: object;
  _onTransformChanged?: EventListener;
}

const makeComp = <El extends BuildingEl>(tag: string, defaultParentTag: string, { data = {}, ...elOpts }: CompOptions = {}): MockComp<El> => ({
  el: makeEl<El>({ tag, parentTag: defaultParentTag, ...elOpts }),
  data
});

export const makeRoomComp = (opts: CompOptions = {}) => makeComp<RoomEl>('a-room', 'a-scene', { walls: [{}, {}, {}], ...opts });
export const makeWallComp = (opts?: CompOptions) => makeComp<WallEl>('a-wall', 'a-room', opts);
export const makeOpeningComp = (opts?: CompOptions) => makeComp<OpeningEl>('a-opening', 'a-wall', opts);
export const makePortalComp = (opts?: CompOptions) => makeComp<PortalEl>('a-portal', 'a-scene', opts);
