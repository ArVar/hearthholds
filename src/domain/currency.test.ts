import { describe, expect, it } from "vitest";
import {
  formatBaseCurrency,
  fromBaseCurrency,
  getCurrencyProfile,
  toBaseCurrency,
} from "./currency";

describe("ruleset currencies", () => {
  it("uses D&D 5e denominations and exact base-unit conversions", () => {
    expect(getCurrencyProfile("D&D 5e").denominations.map(({ id }) => id))
      .toEqual(["pp", "gp", "ep", "sp", "cp"]);
    expect(toBaseCurrency("D&D 5e", 2, "gp")).toBe(200);
    expect(toBaseCurrency("D&D 5e", 10, "sp")).toBe(100);
    expect(fromBaseCurrency("D&D 5e", 250, "gp")).toBe(2.5);
    expect(formatBaseCurrency("D&D 5e", 1_251)).toBe("1 PP · 2 GP · 1 EP · 1 CP");
    expect(formatBaseCurrency("D&D 5e", 1_251, "gp")).toBe("12 GP · 1 EP · 1 CP");
  });
});
