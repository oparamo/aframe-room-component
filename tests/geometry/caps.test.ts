import { describe, it, expect } from 'vitest';
import type { BufferGeometry } from 'three';
import { capGeometry } from '../../src/geometry/caps';

const cornersAt = (points: readonly (readonly [number, number])[]) => points.map(([x, z]) => new THREE.Vector3(x, 0, z));

// The Y component of each triangle's face normal, from its winding.
const faceNormalYs = (geom: BufferGeometry) => {
  const pos = geom.getAttribute('position');
  const index = Array.from(geom.getIndex()?.array ?? []);
  const corner = (i: number) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  const ys = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]].map(i => corner(i ?? 0));
    if (!a || !b || !c) continue;
    ys.push(b.sub(a).cross(c.sub(a)).y);
  }
  return ys;
};

describe('capGeometry', () => {
  it.each([
    { isOutside: false, isCeiling: false, up: true },
    { isOutside: false, isCeiling: true, up: false },
    { isOutside: true, isCeiling: false, up: false },
    { isOutside: true, isCeiling: true, up: true }
  ])('faces triangles up=$up when isCeiling=$isCeiling and isOutside=$isOutside', ({ isOutside, isCeiling, up }) => {
    // Arrange
    const corners = cornersAt([[0, 0], [5, 0], [5, 5], [0, 5]]);

    // Act
    const geom = capGeometry({ corners, isCeiling, isOutside, uvScale: 1 });

    // Assert
    const ys = faceNormalYs(geom);
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) expect(y > 0).toBe(up);
  });

  it('covers a concave room without spanning its notch', () => {
    // Arrange: a U-shaped room, open between x=1 and x=2 for z > 1
    const corners = cornersAt([[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]]);

    // Act
    const geom = capGeometry({ corners, isCeiling: false, isOutside: false, uvScale: 1 });

    // Assert
    const pos = geom.getAttribute('position');
    const index = Array.from(geom.getIndex()?.array ?? []);
    expect(index).toHaveLength((corners.length - 2) * 3);
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]].map(i => i ?? 0);
      const cx = tri.reduce((sum, i) => sum + pos.getX(i), 0) / 3;
      const cz = tri.reduce((sum, i) => sum + pos.getZ(i), 0) / 3;
      const inNotch = cx > 1 && cx < 2 && cz > 1;
      expect(inNotch).toBe(false);
    }
  });
});
