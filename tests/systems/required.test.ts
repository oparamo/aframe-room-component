import { describe, it, expect } from 'vitest';
import { required } from '../../src/systems/required';

describe('required', () => {
  it('returns the value when present', () => {
    // Arrange
    const value = 0;

    // Act
    const result = required(value, 'value');

    // Assert
    expect(result).toBe(0);
  });

  it('throws naming what is missing when the value is undefined', () => {
    // Act / Assert
    expect(() => required(undefined, 'next wall')).toThrow('missing next wall');
  });

  it('throws when the value is null', () => {
    // Act / Assert
    expect(() => required(null, 'geometry index')).toThrow('missing geometry index');
  });
});
