import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  arcSweepRadians,
  canSetPalisadeJunctionMode,
  findClosestPalisadeSegment,
  getPalisadeJunctionHandles,
  getPalisadeJunctionMode,
  movePalisadeJunctionHandle,
  palisadeLength,
  pathLength,
  removePalisadeJunction,
  segmentLength,
  setPalisadeJunctionMode,
  snapAngle,
  splitPalisadeSegment,
} from "./geometry";

describe("map geometry", () => {
  it("snaps rotations to 15 degree steps and normalizes them", () => {
    expect(snapAngle(7)).toBe(0);
    expect(snapAngle(8)).toBe(15);
    expect(snapAngle(-15)).toBe(345);
    expect(snapAngle(370)).toBe(15);
  });

  it("calculates clockwise and counter-clockwise arc sweeps", () => {
    expect(
      arcSweepRadians({
        kind: "arc",
        center: { x: 0, y: 0 },
        radius: 10,
        startAngle: 0,
        endAngle: 90,
        counterClockwise: false,
      }),
    ).toBeCloseTo(Math.PI / 2);

    expect(
      arcSweepRadians({
        kind: "arc",
        center: { x: 0, y: 0 },
        radius: 10,
        startAngle: 0,
        endAngle: -180,
        counterClockwise: true,
      }),
    ).toBeCloseTo(Math.PI);
  });

  it("measures straight palisade segments", () => {
    expect(
      segmentLength({
        kind: "line",
        from: { x: 0, y: 0 },
        to: { x: 3, y: 4 },
      }),
    ).toBe(5);
  });

  it("measures multi-segment map paths", () => {
    expect(
      pathLength({
        id: "test-road",
        name: "Testweg",
        kind: "road",
        points: [0, 0, 3, 4, 6, 8],
        width: 10,
        color: "#000000",
      }),
    ).toBe(10);
  });

  it("measures the full heart-shaped Herzdorf palisade", () => {
    const palisade = createDefaultDocument().map.palisades[0];
    expect(palisade.segments).toHaveLength(6);
    expect(palisade.gates).toHaveLength(0);
    expect(createDefaultDocument().map.gates).toHaveLength(2);
    expect(palisadeLength(palisade)).toBeGreaterThan(2_950);
    expect(palisadeLength(palisade)).toBeLessThan(3_000);
  });

  it("splits and rejoins straight palisade segments", () => {
    const segments = [
      { kind: "line" as const, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
    ];
    const split = splitPalisadeSegment(segments, 0, { x: 40, y: 12 });

    expect(split).toHaveLength(2);
    expect(split[0]).toMatchObject({ to: { x: 40, y: 0 } });
    expect(removePalisadeJunction(split, { x: 40, y: 0 })).toEqual(segments);
  });

  it("splits circular palisade arcs without changing their total length", () => {
    const segment = {
      kind: "arc" as const,
      center: { x: 0, y: 0 },
      radius: 50,
      startAngle: 0,
      endAngle: 180,
      counterClockwise: false,
    };
    const split = splitPalisadeSegment([segment], 0, { x: 0, y: 50 });

    expect(split).toHaveLength(2);
    expect(segmentLength(split[0]) + segmentLength(split[1])).toBeCloseTo(
      segmentLength(segment),
    );
  });

  it("finds the nearest palisade segment and its projected point", () => {
    const hit = findClosestPalisadeSegment(
      [
        { kind: "line", from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
        { kind: "line", from: { x: 100, y: 0 }, to: { x: 100, y: 100 } },
      ],
      { x: 76, y: 8 },
    );

    expect(hit).toMatchObject({ segmentIndex: 0, point: { x: 76, y: 0 } });
  });

  it("converts a wall corner between smooth and corner Bézier nodes", () => {
    const junction = { x: 100, y: 0 };
    const lines = [
      { kind: "line" as const, from: { x: 0, y: 0 }, to: junction },
      { kind: "line" as const, from: junction, to: { x: 100, y: 100 } },
    ];

    const smooth = setPalisadeJunctionMode(lines, junction, "smooth");
    expect(smooth.every((segment) => segment.kind === "bezier")).toBe(true);
    expect(getPalisadeJunctionMode(smooth, junction)).toBe("smooth");
    const smoothHandles = getPalisadeJunctionHandles(smooth, junction);
    const firstVector = {
      x: smoothHandles[0].point.x - junction.x,
      y: smoothHandles[0].point.y - junction.y,
    };
    const secondVector = {
      x: smoothHandles[1].point.x - junction.x,
      y: smoothHandles[1].point.y - junction.y,
    };
    expect(firstVector.x * secondVector.y - firstVector.y * secondVector.x).toBeCloseTo(0);
    expect(firstVector.x * secondVector.x + firstVector.y * secondVector.y).toBeLessThan(0);

    const corner = setPalisadeJunctionMode(smooth, junction, "corner");
    expect(getPalisadeJunctionMode(corner, junction)).toBe("corner");
    const cornerHandle = getPalisadeJunctionHandles(corner, junction)[0].point;
    expect(cornerHandle.x).toBeCloseTo(100 - 100 / 3);
    expect(cornerHandle.y).toBe(0);
  });

  it("converts an existing arc junction into editable Bézier segments", () => {
    const junction = { x: 0, y: 100 };
    const segments = [
      {
        kind: "arc" as const,
        center: { x: 0, y: 0 },
        radius: 100,
        startAngle: -90,
        endAngle: 90,
        counterClockwise: false,
      },
      { kind: "line" as const, from: junction, to: { x: -100, y: 100 } },
    ];

    expect(canSetPalisadeJunctionMode(segments, junction)).toBe(true);
    const smooth = setPalisadeJunctionMode(segments, junction, "smooth");

    expect(smooth).toHaveLength(3);
    expect(smooth.every((segment) => segment.kind === "bezier")).toBe(true);
    expect(getPalisadeJunctionMode(smooth, junction)).toBe("smooth");
    expect(getPalisadeJunctionHandles(smooth, junction)).toHaveLength(2);
  });

  it("converts a junction shared by two circular arcs", () => {
    const junction = { x: 0, y: 100 };
    const segments = [
      {
        kind: "arc" as const,
        center: { x: 0, y: 0 },
        radius: 100,
        startAngle: -90,
        endAngle: 90,
        counterClockwise: false,
      },
      {
        kind: "arc" as const,
        center: { x: 100, y: 100 },
        radius: 100,
        startAngle: 180,
        endAngle: 0,
        counterClockwise: false,
      },
    ];

    expect(canSetPalisadeJunctionMode(segments, junction)).toBe(true);
    const smooth = setPalisadeJunctionMode(segments, junction, "smooth");

    expect(smooth).toHaveLength(4);
    expect(smooth.every((segment) => segment.kind === "bezier")).toBe(true);
    expect(getPalisadeJunctionMode(smooth, junction)).toBe("smooth");
  });

  it("allows the knot mode of an open wall endpoint to be changed", () => {
    const endpoint = { x: 0, y: 0 };
    const segments = [
      { kind: "line" as const, from: endpoint, to: { x: 100, y: 0 } },
    ];

    expect(canSetPalisadeJunctionMode(segments, endpoint)).toBe(true);
    const smooth = setPalisadeJunctionMode(segments, endpoint, "smooth");

    expect(smooth[0].kind).toBe("bezier");
    expect(getPalisadeJunctionMode(smooth, endpoint)).toBe("smooth");
    expect(getPalisadeJunctionHandles(smooth, endpoint)).toHaveLength(1);
  });

  it("keeps smooth wall handles collinear while dragging", () => {
    const junction = { x: 100, y: 0 };
    const smooth = setPalisadeJunctionMode(
      [
        { kind: "line", from: { x: 0, y: 0 }, to: junction },
        { kind: "line", from: junction, to: { x: 100, y: 100 } },
      ],
      junction,
      "smooth",
    );
    const moved = movePalisadeJunctionHandle(
      smooth,
      junction,
      0,
      { x: 65, y: -20 },
    );
    const handles = getPalisadeJunctionHandles(moved, junction);
    const left = {
      x: handles[0].point.x - junction.x,
      y: handles[0].point.y - junction.y,
    };
    const right = {
      x: handles[1].point.x - junction.x,
      y: handles[1].point.y - junction.y,
    };

    expect(left.x * right.y - left.y * right.x).toBeCloseTo(0);
    expect(left.x * right.x + left.y * right.y).toBeLessThan(0);
  });

  it("splits a Bézier wall segment without changing its length", () => {
    const segment = setPalisadeJunctionMode(
      [
        { kind: "line", from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
        { kind: "line", from: { x: 100, y: 0 }, to: { x: 100, y: 100 } },
      ],
      { x: 100, y: 0 },
      "smooth",
    )[0];
    const before = segmentLength(segment);
    const split = splitPalisadeSegment([segment], 0, { x: 55, y: -8 });

    expect(split).toHaveLength(2);
    expect(split[0].kind).toBe("bezier");
    expect(segmentLength(split[0]) + segmentLength(split[1])).toBeCloseTo(before, 1);
  });
});
