import { describe, it, expect } from 'vitest';
import type { OpeningEdges } from '../../src/types/geometry';
import { openingEdges, openingFitProblem, openingPlacement, openingsOverlap, wallSpan } from '../../src/geometry/walls';

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

describe('openingFitProblem', () => {
  const spanOfLength = (length: number) =>
    wallSpan(new THREE.Vector3(0, 0, 0), new THREE.Vector3(length, 0, 0), { start: 2, end: 2 });

  it.each([
    { case: 'a wall with no length', length: 0, width: 1, problem: 'is on a wall with no length' },
    { case: 'an opening wider than its wall', length: 1, width: 1.5, problem: 'is wider than its wall' },
    { case: 'an opening as wide as its wall', length: 1, width: 1, problem: 'is wider than its wall' },
    { case: 'an opening that fits', length: 1, width: 0.99, problem: null }
  ])('reports $case', ({ length, width, problem }) => {
    // Act
    const result = openingFitProblem(spanOfLength(length), width);

    // Assert
    expect(result).toBe(problem);
  });
});

describe('openingsOverlap', () => {
  // An opening from left to right along its wall and from bottom to top up it, on a level wall.
  const edges = ([left, right]: [number, number], [bottom, top]: [number, number]): OpeningEdges => ({
    left: { ptX: left, bottomY: bottom, topY: top },
    right: { ptX: right, bottomY: bottom, topY: top }
  });
  const door = edges([1, 2], [0, 2]);

  it.each([
    { case: 'overlaps a door it crosses', other: edges([1.5, 2.5], [0, 2]), overlaps: true },
    { case: 'overlaps a door whose edge it shares', other: edges([2, 3], [0, 2]), overlaps: true },
    { case: 'overlaps a door just under a HAIR away', other: edges([2.00005, 3], [0, 2]), overlaps: true },
    { case: 'leaves a door further along the wall', other: edges([2.5, 3.5], [0, 2]), overlaps: false },
    { case: 'leaves a high window above the door', other: edges([1, 2], [2.1, 2.6]), overlaps: false }
  ])('$case', ({ other, overlaps }) => {
    // Act
    const result = [openingsOverlap(door, other), openingsOverlap(other, door)];

    // Assert: the same either way round
    expect(result).toEqual([overlaps, overlaps]);
  });
});
