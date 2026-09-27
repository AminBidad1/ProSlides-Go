import type { LiveSessionLocator } from "../api/types.ts";

const ACCESS_SESSION_RECOVERY_PREFIX = "proslides_live_access_session_v1:";
const MAX_RECOVERY_AGE_MS = 24 * 60 * 60 * 1000;

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredAccessSession = {
  version: 1;
  access_code: string;
  stored_at: number;
  locator: LiveSessionLocator;
};

const normalizeAccessCode = (value: string): string =>
  String(value || "").trim().toUpperCase();

const defaultStorage = (): RecoveryStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const accessSessionRecoveryKey = (accessCode: string): string =>
  ACCESS_SESSION_RECOVERY_PREFIX + normalizeAccessCode(accessCode);

export const saveAccessSessionRecovery = (
  accessCode: string,
  locator: LiveSessionLocator,
  storage: RecoveryStorage | null = defaultStorage(),
  now = Date.now(),
): void => {
  const normalized = normalizeAccessCode(accessCode);
  if (!normalized || !locator.session_id || !storage) return;

  const value: StoredAccessSession = {
    version: 1,
    access_code: normalized,
    stored_at: now,
    locator,
  };

  try {
    storage.setItem(
      accessSessionRecoveryKey(normalized),
      JSON.stringify(value),
    );
  } catch {
    // Participant recovery is best-effort and must never block live entry.
  }
};

export const readAccessSessionRecovery = (
  accessCode: string,
  storage: RecoveryStorage | null = defaultStorage(),
  now = Date.now(),
): LiveSessionLocator | null => {
  const normalized = normalizeAccessCode(accessCode);
  if (!normalized || !storage) return null;

  try {
    const raw = storage.getItem(accessSessionRecoveryKey(normalized));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredAccessSession>;
    const valid =
      parsed.version === 1 &&
      parsed.access_code === normalized &&
      typeof parsed.stored_at === "number" &&
      now - parsed.stored_at >= 0 &&
      now - parsed.stored_at <= MAX_RECOVERY_AGE_MS &&
      parsed.locator != null &&
      typeof parsed.locator === "object" &&
      typeof parsed.locator.session_id === "string" &&
      Boolean(parsed.locator.session_id) &&
      typeof parsed.locator.presentation_id === "string" &&
      parsed.locator.presentation != null &&
      typeof parsed.locator.presentation === "object";

    if (!valid) {
      storage.removeItem(accessSessionRecoveryKey(normalized));
      return null;
    }

    return parsed.locator as LiveSessionLocator;
  } catch {
    try {
      storage.removeItem(accessSessionRecoveryKey(normalized));
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
};

export const clearAccessSessionRecovery = (
  accessCode: string,
  storage: RecoveryStorage | null = defaultStorage(),
): void => {
  if (!storage) return;
  try {
    storage.removeItem(accessSessionRecoveryKey(accessCode));
  } catch {
    // Ignore storage cleanup failures.
  }
};
