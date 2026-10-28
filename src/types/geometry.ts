import type { Vector3 } from 'three';

type SurfaceType = 'floor' | 'ceiling' | 'sides';

// Vertex layout per opening: [0]=left-bottom, [1]=left-top, [2]=right-bottom, [3]=right-top.
type OpeningCorners = readonly [Vector3, Vector3, Vector3, Vector3];

// The size of the hole a portal cuts in a wall. floorHeight above 0 makes it a window.
interface OpeningSize {
  width: number;
  height: number;
  floorHeight: number;
}

// A wall measured against the next wall in the loop, in the wall's local frame.
interface WallSpan {
  length: number;
  gapX: number;
  gapY: number;
  gapZ: number;
  // The wall's own height, and how much taller the next wall is.
  height: number;
  heightGap: number;
}

// One side of an opening on its wall: x along the wall, and the y of its bottom and top.
interface OpeningEdge { ptX: number; bottomY: number; topY: number }
interface OpeningEdges { left: OpeningEdge; right: OpeningEdge }

export type { OpeningCorners, OpeningEdge, OpeningEdges, OpeningSize, SurfaceType, WallSpan };
