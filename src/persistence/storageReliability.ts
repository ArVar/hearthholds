export type StorageFailureCode = "quota" | "validation" | "write";

export class DocumentStorageError extends Error {
  constructor(
    public readonly code: StorageFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "DocumentStorageError";
  }
}

export function toDocumentStorageError(error: unknown): DocumentStorageError {
  if (error instanceof DocumentStorageError) return error;
  const seen = new Set<unknown>();
  const containsQuotaFailure = (candidate: unknown): boolean => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    if (candidate instanceof Error || candidate instanceof DOMException) {
      if (
        candidate.name === "QuotaExceededError"
        || candidate.name === "NS_ERROR_DOM_QUOTA_REACHED"
        || /quotaexceeded|storage full/i.test(candidate.message)
      ) return true;
    }
    if (typeof candidate === "object") {
      const wrapped = candidate as { cause?: unknown; inner?: unknown };
      return containsQuotaFailure(wrapped.cause) || containsQuotaFailure(wrapped.inner);
    }
    return false;
  };
  if (containsQuotaFailure(error)) {
    return new DocumentStorageError("quota", { cause: error });
  }
  return new DocumentStorageError("write", {
    cause: error instanceof Error ? error : undefined,
  });
}

export async function requestPersistentStorage(
  storage: Pick<StorageManager, "persist"> | undefined = navigator.storage,
): Promise<boolean | null> {
  if (!storage?.persist) return null;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}
