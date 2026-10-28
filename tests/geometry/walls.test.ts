import { describe, it, expect } from 'vitest';
import { openingEdges, openingPlacement, wallSpan } from '../../src/geometry/walls';

describe('openingEdges', () => {
  it('clamps the opening top to the wall height when the portal is taller than the wall', () => {
    // Arrange: wall height 2, portal height 3
    const span = wallSpan(new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0), { start: 2, end: 2 });

    // Act
    const { left } = openingEdges({ span, openingX: 2.5, portal: { width: 1, height: 3, floorHeight: 0 } });

    // Assert: just below the wall top (2 - HAIR)
    expect(left.topY).toBeCloseTo(2 - 0.0001, 3);
  });
});

describe('openingPlacement', () => {
  it('positions the opening Y to match the wall slope at its X', () => {
    // Arrange: the wall runs from (0, 0, 0) to (4, 2, 4), rising 2 over an XZ length of about 5.66
    const wallStart = new THREE.Vector3(0, 0, 0);
    const span = wallSpan(wallStart, new THREE.Vector3(4, 2, 4), { start: 3, end: 3 });

    // Act
    const { x, y } = openingPlacement({ span, wallStart, portalAt: new THREE.Vector3(2, 0, 2), halfWidth: 0.5 });

    // Assert: halfway along the wall, so halfway up the rise
    const wallLength = Math.hypot(4, 4);
    expect(x).toBeCloseTo(wallLength / 2, 2);
    expect(y).toBeCloseTo(1, 2);
  });
});
