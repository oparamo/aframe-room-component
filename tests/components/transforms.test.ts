import { describe, it, expect } from 'vitest';
import { TRANSFORM_PROPS } from '../../src/components/transforms';

describe('TRANSFORM_PROPS', () => {
  it('contains position, rotation, and scale', () => {
    // Assert
    expect(TRANSFORM_PROPS.has('position')).toBe(true);
    expect(TRANSFORM_PROPS.has('rotation')).toBe(true);
    expect(TRANSFORM_PROPS.has('scale')).toBe(true);
  });
});
