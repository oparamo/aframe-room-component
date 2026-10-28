import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildPortal } from '../../src/builders/portal';
import { makeOpeningVerts, makePortalChild, makePortal } from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());

describe('buildPortal', () => {
  const fromVerts = makeOpeningVerts({ x: 0, width: 2, height: 2.5 });
  const toVerts = makeOpeningVerts({ x: 0, width: 2, height: 2.5 });

  it('frees the previous surface geometry when rebuilt', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });
    buildPortal(portal);
    const disposed = vi.fn();
    floorChild.mesh?.geometry.addEventListener('dispose', disposed);

    // Act
    buildPortal(portal);

    // Assert
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('keeps the surface mesh when rebuilt', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });
    buildPortal(portal);
    const firstMesh = floorChild.mesh;

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).toBe(firstMesh);
  });

  it('creates a mesh on a floor child', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a ceiling child', () => {
    // Arrange
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a sides child', () => {
    // Arrange
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh).not.toBeNull();
  });

  it('floor geometry has 4 vertices', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('ceiling geometry has 4 vertices', () => {
    // Arrange
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('sides geometry has 8 vertices', () => {
    // Arrange
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh?.geometry.getAttribute('position').count).toBe(8);
  });

  it('logs an error and does nothing when from element is missing', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts: null, toVerts, children: [floorChild] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('includes portal id in error message when id is set', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts: null, toVerts, children: [floorChild] });
    portal.id = 'my-portal';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('#my-portal'));
  });

  it('logs an error and does nothing when to element is missing', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts: null, children: [floorChild] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('skips children with no matching type component', () => {
    // Arrange: child has no floor/ceiling/sides component
    const unknownChild = makePortalChild({ type: 'floor' });
    unknownChild.components = {};
    const portal = makePortal({ fromVerts, toVerts, children: [unknownChild] });

    // Act / Assert: should not throw and mesh remains null
    expect(() => buildPortal(portal)).not.toThrow();
    expect(unknownChild.mesh).toBeNull();
  });

  it('processes multiple children in one call', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild, ceilingChild, sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
    expect(ceilingChild.mesh).not.toBeNull();
    expect(sidesChild.mesh).not.toBeNull();
  });
});
