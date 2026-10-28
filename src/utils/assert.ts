// Narrows a value the build code knows is present but the type system cannot prove, such as
// an element of a closed wall loop or the index of a geometry the build made itself.
const assertDefined = <T>(value: T | null | undefined, what: string): T => {
  if (value == null) throw new Error(`Missing ${what}.`);
  return value;
};

export { assertDefined };
