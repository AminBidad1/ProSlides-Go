type UUIDCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

export const createSecureUUID = (
  cryptoSource: UUIDCrypto | undefined = globalThis.crypto,
): string => {
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  // randomUUID may be unavailable in non-secure browser contexts, while
  // getRandomValues is still broadly available. Preserve UUID v4 semantics
  // rather than falling back to Math.random for persisted client identifiers.
  if (typeof cryptoSource?.getRandomValues !== "function") {
    throw new Error("Secure random UUID generation is unavailable");
  }

  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
