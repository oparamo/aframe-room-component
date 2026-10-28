import { describe, it, expect } from 'vitest';
import { capOf, dataOf, portalEnds, wallHeight, wallsOf } from '../../../src/builders/helpers/structure';
import { makeCap, makeOpening, makePortal, makeRoom, makeSquareRoom, makeWall } from '../../utils/mocks';

describe('wallsOf', () => {
  it('leaves out the walls of a room nested inside a wall', () => {
    // Arrange
    const outerWall = makeWall({ others: [makeSquareRoom()] });
    const room = makeRoom([outerWall, makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })]);

    // Act
    const walls = wallsOf(room);

    // Assert
    expect(walls).toHaveLength(3);
  });
});

describe('capOf', () => {
  it('finds the room\'s own floor, not one inside a portal on its wall', () => {
    // Arrange: a room with no floor of its own
    const wall = makeWall({ others: [makePortal({ children: [makeCap({ kind: 'floor' })] })] });
    const room = makeRoom([wall, makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })], { caps: [] });

    // Act
    const floor = capOf(room, 'floor');

    // Assert
    expect(floor).toBeNull();
  });
});

describe('wallHeight', () => {
  it('uses the wall\'s own height', () => {
    // Arrange
    const wall = makeWall({ height: 3.5 });
    makeRoom([wall, makeWall(), makeWall()], { height: 2.4 });

    // Act / Assert
    expect(wallHeight(wall)).toBe(3.5);
  });

  it('falls back to the room\'s height when the wall has none', () => {
    // Arrange
    const wall = makeWall({ height: 0 });
    makeRoom([wall, makeWall(), makeWall()], { height: 2.4 });

    // Act / Assert
    expect(wallHeight(wall)).toBe(2.4);
  });
});

describe('dataOf', () => {
  it('names the element and component when the data is missing', () => {
    // Act / Assert
    expect(() => dataOf(makeOpening(), 'portal')).toThrow('<a-opening> portal data');
  });
});

describe('portalEnds', () => {
  it('keeps openings and drops anything else', () => {
    // Arrange
    const opening = makeOpening();

    // Act
    const ends = portalEnds({ from: opening, to: makeWall() });

    // Assert
    expect(ends).toEqual({ from: opening, to: null });
  });
});
