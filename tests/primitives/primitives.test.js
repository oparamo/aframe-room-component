import { describe, it, expect } from 'vitest';
import '../../src/primitives/a-ceiling.js';
import '../../src/primitives/a-floor.js';
import '../../src/primitives/a-opening.js';
import '../../src/primitives/a-portal.js';
import '../../src/primitives/a-room.js';
import '../../src/primitives/a-sides.js';
import '../../src/primitives/a-wall.js';

describe('primitives', () => {
  it('registers a-ceiling', () => {
    // Assert
    expect(AFRAME._primitives['a-ceiling']).toBeDefined();
  });

  it('registers a-floor', () => {
    // Assert
    expect(AFRAME._primitives['a-floor']).toBeDefined();
  });

  it('registers a-opening', () => {
    // Assert
    expect(AFRAME._primitives['a-opening']).toBeDefined();
  });

  it('registers a-portal', () => {
    // Assert
    expect(AFRAME._primitives['a-portal']).toBeDefined();
  });

  it('registers a-room', () => {
    // Assert
    expect(AFRAME._primitives['a-room']).toBeDefined();
  });

  it('registers a-sides', () => {
    // Assert
    expect(AFRAME._primitives['a-sides']).toBeDefined();
  });

  it('registers a-wall', () => {
    // Assert
    expect(AFRAME._primitives['a-wall']).toBeDefined();
  });
});
