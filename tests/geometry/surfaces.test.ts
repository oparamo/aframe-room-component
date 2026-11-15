import { describe, it, expect } from 'vitest';
import type { BufferGeometry } from 'three';
import type { OpeningCorners, SurfaceType } from '../../src/types/geometry';
import { surfaceCorners, surfaceGeometry } from '../../src/geometry/surfaces';

// UVs as [u, v] pairs, rounded so float noise doesn't fail an exact comparison.
const uvPairs = (geom: BufferGeometry) => {
  const uv = geom.getAttribute('uv');
  return Array.from({ length: uv.count }, (_, i) => [uv.getX(i), uv.getY(i)].map(n => Math.round(n * 1e4) / 1e4));
};

// Unit normals, rounded so float noise doesn't fail an exact comparison.
const normals = (geom: BufferGeometry) => {
  const normal = geom.getAttribute('normal');
  return Array.from({ length: normal.count }, (_, i) =>
    [normal.getX(i), normal.getY(i), normal.getZ(i)].map(n => Math.round(n * 1e4) / 1e4 + 0));
};

// A doorway 1 m wide and 2 m tall through a wall 3 m thick. Each opening's left is on the left as
// seen from inside its own room, so the near room lies toward +z and the far room toward -z, and
// the far opening's left edge lines up with the near one's right.
const openingAt = (left: number, right: number, z: number): OpeningCorners => [
  new THREE.Vector3(left, 0, z), new THREE.Vector3(left, 2, z), new THREE.Vector3(right, 0, z), new THREE.Vector3(right, 2, z)
];
const near = openingAt(-0.5, 0.5, 0);
const far = openingAt(0.5, -0.5, -3);

// The corners stand in for the from room's local space too, as if the room sat at the origin.
const buildSurface = (type: SurfaceType, uvScale = 1) => {
  const corners = surfaceCorners(type, near, far);
  return surfaceGeometry({ type, roomCorners: corners, positions: corners.flatMap(vertex => vertex.toArray()), uvScale });
};

describe('surfaceGeometry UVs', () => {
  it('maps the floor from the room\'s x and z the way a room floor does, u along -x', () => {
    // Act
    const geom = buildSurface('floor');

    // Assert: the corners' x runs 0.5, -0.5, 0.5, -0.5
    expect(uvPairs(geom)).toEqual([[-0.5, -3], [0.5, -3], [-0.5, 0], [0.5, 0]]);
  });

  it('maps the ceiling from the room\'s x and z the way a room ceiling does, u along +x', () => {
    // Act
    const geom = buildSurface('ceiling');

    // Assert: the corners' x runs -0.5, 0.5, -0.5, 0.5
    expect(uvPairs(geom)).toEqual([[-0.5, -3], [0.5, -3], [-0.5, 0], [0.5, 0]]);
  });

  it('multiplies the UVs by uv-scale', () => {
    // Act
    const geom = buildSurface('floor', 2);

    // Assert
    expect(uvPairs(geom)).toEqual([[-1, -6], [1, -6], [-1, 0], [1, 0]]);
  });

  it('spans each side wall in meters, with V running up the wall', () => {
    // Act
    const geom = buildSurface('sides');

    // Assert
    const sideWall = [[3, 0], [3, 2], [0, 0], [0, 2]];
    expect(uvPairs(geom)).toEqual([...sideWall, ...sideWall]);
  });
});

describe('surfaceGeometry facing', () => {
  it('faces the floor up', () => {
    // Act
    const geom = buildSurface('floor');

    // Assert
    expect(normals(geom)).toEqual(Array(4).fill([0, 1, 0]));
  });

  it('faces the ceiling down', () => {
    // Act
    const geom = buildSurface('ceiling');

    // Assert
    expect(normals(geom)).toEqual(Array(4).fill([0, -1, 0]));
  });

  it('faces each side wall into the doorway', () => {
    // Act
    const geom = buildSurface('sides');

    // Assert: the first quad is the side at x = -0.5, the second the side at x = 0.5
    expect(normals(geom)).toEqual([...Array<number[]>(4).fill([1, 0, 0]), ...Array<number[]>(4).fill([-1, 0, 0])]);
  });
});
