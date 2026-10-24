// Narrows a value the geometry code knows is present but the type system cannot prove, such as
// an element of a closed wall loop or the index of a geometry this module built itself.
const required = <T>(value: T | null | undefined, what: string): T => {
  if (value == null) throw new Error(`buildingService: missing ${what}.`);
  return value;
};

export { required };
