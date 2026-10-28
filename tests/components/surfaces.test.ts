import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeEl, registeredComponent } from '../utils/mocks';
import '../../src/components/ceiling';
import '../../src/components/floor';
import '../../src/components/sides';

afterEach(() => vi.restoreAllMocks());

describe.each([
  { name: 'floor', parents: ['a-room', 'a-portal'], misplaced: 'a-scene' },
  { name: 'ceiling', parents: ['a-room', 'a-portal'], misplaced: 'a-scene' },
  { name: 'sides', parents: ['a-portal'], misplaced: 'a-room' }
])('$name', ({ name, parents, misplaced }) => {
  it.each(parents)(`accepts a parent %s`, (parentTag) => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const comp = { el: makeEl({ tag: `a-${name}`, parentTag }) };

    // Act
    registeredComponent(name).init.call(comp);

    // Assert
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it(`logs a markup error under ${misplaced}`, () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const comp = { el: makeEl({ tag: `a-${name}`, parentTag: misplaced }) };

    // Act
    registeredComponent(name).init.call(comp);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
