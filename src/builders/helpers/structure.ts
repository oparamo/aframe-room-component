import type { Entity } from '../../types/aframe';
import type { BuildingEl, ComponentDataMap, OpeningEl, PortalData, RoomEl, WallEl } from '../../types/elements';
import { assertDefined } from '../../utils/assert';

// The structure is read from the DOM on every build, so it is never out of date.

// How log messages name an element: by id when it has one, otherwise by tag.
const nameOf = (el: Entity) => el.id ? `#${el.id}` : `<${el.localName}>`;

// The data of a component the element must have.
const dataOf = <K extends keyof ComponentDataMap>(el: BuildingEl, name: K): ComponentDataMap[K] =>
  assertDefined(el.getAttribute(name), `<${el.localName}> ${name} data`);

// The element's own children with the tag, leaving out those of nested rooms and portals.
const childrenNamed = <T extends BuildingEl>(el: BuildingEl, localName: string) =>
  [...el.children].filter((child): child is T => child.localName === localName);

const wallsOf = (roomEl: RoomEl) => childrenNamed<WallEl>(roomEl, 'a-wall');

const openingsOf = (wallEl: WallEl) => childrenNamed<OpeningEl>(wallEl, 'a-opening');

const capOf = (roomEl: RoomEl, kind: 'floor' | 'ceiling') => childrenNamed(roomEl, `a-${kind}`)[0] ?? null;

// A wall's own height, or its room's when it has none.
const wallHeight = (wallEl: WallEl) => dataOf(wallEl, 'wall').height || dataOf(wallEl.parentEl, 'room').height;

// Whether the wall stops the player: it does when both it and its room are collidable.
const isCollidable = (wallEl: WallEl) => dataOf(wallEl, 'wall').collidable && dataOf(wallEl.parentEl, 'room').collidable;

// A-Frame elements in a portal's children: what its floor, ceiling and sides are made of.
const isEntity = (el: Element): el is BuildingEl => 'object3D' in el;

const isOpening = (el: Entity | null | undefined): el is OpeningEl => el?.localName === 'a-opening';

// The openings a portal joins. An end whose selector matched nothing, or something other than an
// a-opening, is null.
const portalEnds = ({ from, to }: Partial<PortalData>) => ({
  from: isOpening(from) ? from : null,
  to: isOpening(to) ? to : null
});

export { capOf, dataOf, isCollidable, isEntity, isOpening, nameOf, openingsOf, portalEnds, wallHeight, wallsOf };
