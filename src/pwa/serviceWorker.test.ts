import { describe, expect, it, vi } from "vitest";
import { activateWaitingWorker } from "./serviceWorker";

describe("PWA update activation", () => {
  it("keeps the waiting worker inactive when saving is not safe", async () => {
    const postMessage = vi.fn();
    const beforeActivation = vi.fn();

    await expect(activateWaitingWorker(
      { postMessage },
      async () => false,
      beforeActivation,
    )).resolves.toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
    expect(beforeActivation).not.toHaveBeenCalled();
  });

  it("activates the waiting worker only after the current state is safe", async () => {
    const order: string[] = [];
    const postMessage = vi.fn(() => order.push("message"));

    await expect(activateWaitingWorker(
      { postMessage },
      async () => {
        order.push("saved");
        return true;
      },
      () => order.push("activate"),
    )).resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(order).toEqual(["saved", "activate", "message"]);
  });
});
