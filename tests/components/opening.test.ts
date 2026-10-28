import { describe, it, expect } from 'vitest';
import { makeOpeningComp, registeredComponent } from '../utils/mocks';
import '../../src/components/opening';

describe('opening', () => {
  describe('init', () => {
    it('throws when parent is not a-wall', () => {
      // Arrange
      const comp = makeOpeningComp({ parentTag: 'a-room' });

      // Act / Assert
      expect(() => registeredComponent('opening').init.call(comp)).toThrow();
    });

    it('accepts an a-wall parent', () => {
      // Arrange
      const comp = makeOpeningComp();

      // Act / Assert
      expect(() => registeredComponent('opening').init.call(comp)).not.toThrow();
    });
  });
});
