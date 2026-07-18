import { describe, expect, it } from "vitest";
import {
  cubicBezierPoint,
  findClosestPathSegment,
  getPathAnchors,
  movePathHandle,
  splitPathSegment,
} from "./pathGeometry";
import type { MapPath, PathAnchor } from "./types";

const curvedPath: MapPath = {
  id: "curve",
  name: "Kurve",
  kind: "road",
  points: [0, 0, 50, 50, 100, 0],
  width: 12,
  color: "#765432",
};

describe("path geometry", () => {
  it("derives smooth bezier anchors from legacy point lists", () => {
    const anchors = getPathAnchors(curvedPath);

    expect(anchors).toHaveLength(3);
    expect(anchors[1]).toMatchObject({ x: 50, y: 50, mode: "smooth" });
    expect(anchors[1].handleIn).toBeDefined();
    expect(anchors[1].handleOut).toBeDefined();
  });

  it("keeps both handles collinear at a smooth anchor", () => {
    const anchors = getPathAnchors(curvedPath);
    const moved = movePathHandle(anchors, 1, "out", { x: 80, y: 80 });
    const anchor = moved[1];
    const incoming = anchor.handleIn!;
    const outgoing = anchor.handleOut!;
    const crossProduct =
      (incoming.x - anchor.x) * (outgoing.y - anchor.y) -
      (incoming.y - anchor.y) * (outgoing.x - anchor.x);

    expect(crossProduct).toBeCloseTo(0);
    expect(incoming.x).toBeLessThan(anchor.x);
    expect(outgoing.x).toBeGreaterThan(anchor.x);
  });

  it("splits a cubic segment without changing its curve", () => {
    const anchors: PathAnchor[] = [
      {
        x: 0,
        y: 0,
        mode: "smooth",
        handleOut: { x: 30, y: 70 },
      },
      {
        x: 100,
        y: 0,
        mode: "smooth",
        handleIn: { x: 70, y: 70 },
      },
    ];
    const quarter = cubicBezierPoint(anchors[0], anchors[1], 0.25);
    const threeQuarters = cubicBezierPoint(anchors[0], anchors[1], 0.75);
    const split = splitPathSegment(anchors, 0);

    expect(cubicBezierPoint(split[0], split[1], 0.5)).toEqual(quarter);
    expect(cubicBezierPoint(split[1], split[2], 0.5)).toEqual(threeQuarters);
  });

  it("finds and splits the segment nearest to a pointer", () => {
    const anchors = getPathAnchors(curvedPath);
    const hit = findClosestPathSegment(anchors, { x: 77, y: 36 });

    expect(hit?.segmentIndex).toBe(1);
    const split = splitPathSegment(anchors, hit!.segmentIndex, hit!.amount);
    expect(split).toHaveLength(4);
    expect(split[2].x).toBeCloseTo(hit!.point.x);
    expect(split[2].y).toBeCloseTo(hit!.point.y);
  });
});
