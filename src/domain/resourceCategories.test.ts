import { describe, expect, it } from "vitest";
import { getResourceCategory } from "./resourceCategories";

describe("resource categories", () => {
  it("groups agricultural products without affecting unrelated resources", () => {
    expect(getResourceCategory("grain")?.id).toBe("agriculture");
    expect(getResourceCategory("hops")?.id).toBe("agriculture");
    expect(getResourceCategory("wood")).toBeUndefined();
  });

  it("groups distinct ores under mining", () => {
    expect(getResourceCategory("ironOre")?.id).toBe("mining");
    expect(getResourceCategory("copperOre")?.id).toBe("mining");
    expect(getResourceCategory("goldOre")?.id).toBe("mining");
  });
});
