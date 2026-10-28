import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BuildingEl, BuildState } from '../../src/types/elements';
import { buildPortal } from '../../src/builders/portal';
import { meshOf } from '../utils/meshes';
import {
  makeBuildState, makeOpening, makeOpeningCorners, makePortal, makePortalChild, makeRoom, makeWall
} from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());

// A portal between two openings whose corners the state already holds, as after their rooms built.
const makeBuiltPortal = ({ children = [] as BuildingEl[], recorded = { from: true, to: true } } = {}) => {
  const from = makeOpening();
  const to = makeOpening();
  makeRoom([makeWall({ openings: [from] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })]);
  const state: BuildState = makeBuildState();
  if (recorded.from) state.cornersOf.set(from, makeOpeningCorners({ x: 0, width: 2, height: 2.5 }));
  if (recorded.to) state.cornersOf.set(to, makeOpeningCorners({ x: 0, width: 2, height: 2.5 }));
  return { portal: makePortal({ from, to, children }), state };
};

describe('buildPortal', () => {
  it('frees the previous surface geometry when rebuilt', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const { portal, state } = makeBuiltPortal({ children: [floorChild] });
    buildPortal(portal, state);
    const disposed = vi.fn();
    meshOf(floorChild).geometry.addEventListener('dispose', disposed);

    // Act
    buildPortal(portal, state);

    // Assert
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('keeps the surface mesh when rebuilt', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const { portal, state } = makeBuiltPortal({ children: [floorChild] });
    buildPortal(portal, state);
    const firstMesh = meshOf(floorChild);

    // Act
    buildPortal(portal, state);

    // Assert
    expect(meshOf(floorChild)).toBe(firstMesh);
  });

  it.each([
    { type: 'floor', count: 4 },
    { type: 'ceiling', count: 4 },
    { type: 'sides', count: 8 }
  ])('gives a $type child a mesh of $count vertices', ({ type, count }) => {
    // Arrange
    const child = makePortalChild({ type });
    const { portal, state } = makeBuiltPortal({ children: [child] });

    // Act
    buildPortal(portal, state);

    // Assert
    expect(meshOf(child).geometry.getAttribute('position').count).toBe(count);
  });

  it.each([
    { end: 'from', recorded: { from: false, to: true } },
    { end: 'to', recorded: { from: true, to: false } }
  ])('logs an error and does nothing when the $end corners are missing', ({ recorded }) => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const { portal, state } = makeBuiltPortal({ children: [floorChild], recorded });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal, state);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.object3DMap).toEqual({});
  });

  it('logs an error when from is not an opening', () => {
    // Arrange
    const portal = makePortal({ from: makeWall(), to: makeOpening() });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal, makeBuildState());

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('includes portal id in error message when id is set', () => {
    // Arrange
    const { portal, state } = makeBuiltPortal({ recorded: { from: false, to: false } });
    portal.id = 'my-portal';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal, state);

    // Assert
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('#my-portal'));
  });

  it('skips children with no matching type component', () => {
    // Arrange: child has no floor/ceiling/sides component
    const unknownChild = makePortalChild({ type: 'floor' });
    unknownChild.components = {};
    const { portal, state } = makeBuiltPortal({ children: [unknownChild] });

    // Act
    buildPortal(portal, state);

    // Assert
    expect(unknownChild.object3DMap).toEqual({});
  });

  it('skips children that are not A-Frame entities', () => {
    // Arrange
    const { portal, state } = makeBuiltPortal();
    Object.assign(portal, { children: [{ localName: 'span' }] });

    // Act / Assert
    expect(() => buildPortal(portal, state)).not.toThrow();
  });
});
