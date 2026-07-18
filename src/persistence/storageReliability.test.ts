import { describe, expect, it, vi } from "vitest";
import {
  DocumentStorageError,
  requestPersistentStorage,
  toDocumentStorageError,
} from "./storageReliability";

describe("storage reliability", () => {
  it("requests durable browser storage when supported", async () => {
    const persist = vi.fn().mockResolvedValue(true);

    await expect(requestPersistentStorage({ persist })).resolves.toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("keeps working when durable storage is unavailable or denied", async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBeNull();
    await expect(requestPersistentStorage({
      persist: vi.fn().mockRejectedValue(new Error("denied")),
    })).resolves.toBe(false);
  });

  it("classifies quota and generic write failures", () => {
    expect(toDocumentStorageError(
      new DOMException("full", "QuotaExceededError"),
    ).code).toBe("quota");
    expect(toDocumentStorageError(Object.assign(new Error("wrapped"), {
      inner: new DOMException("storage full", "QuotaExceededError"),
    })).code).toBe("quota");
    expect(toDocumentStorageError(new Error("broken")).code).toBe("write");
    expect(toDocumentStorageError(new DocumentStorageError("validation")).code)
      .toBe("validation");
  });
});
