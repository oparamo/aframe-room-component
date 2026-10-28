// Triangle indices for a quad of four corners, split along the 1-2 diagonal so corners 0 and 3 sit
// opposite each other. TWO_QUADS does the same for corners 4-7.
const QUAD = [0, 1, 2, 1, 3, 2];
const TWO_QUADS = [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6];

export { QUAD, TWO_QUADS };
