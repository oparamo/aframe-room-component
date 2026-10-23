import { describe, it, expect } from 'vitest';
import { registeredPrimitive } from '../utils/mocks';
import '../../src/primitives';

describe('primitives', () => {
  it('registers a-ceiling', () => {
    // Assert
    expect(registeredPrimitive('a-ceiling')).toBeDefined();
  });

  it('registers a-floor', () => {
    // Assert
    expect(registeredPrimitive('a-floor')).toBeDefined();
  });

  it('registers a-opening', () => {
    // Assert
    expect(registeredPrimitive('a-opening')).toBeDefined();
  });

  it('registers a-portal', () => {
    // Assert
    expect(registeredPrimitive('a-portal')).toBeDefined();
  });

  it('registers a-room', () => {
    // Assert
    expect(registeredPrimitive('a-room')).toBeDefined();
  });

  it('registers a-sides', () => {
    // Assert
    expect(registeredPrimitive('a-sides')).toBeDefined();
  });

  it('registers a-wall', () => {
    // Assert
    expect(registeredPrimitive('a-wall')).toBeDefined();
  });
});
