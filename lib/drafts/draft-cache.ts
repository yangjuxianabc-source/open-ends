import { useCallback, useEffect, useRef, useState } from "react";

export const DRAFT_VERSION = 1 as const;
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_AUTOSAVE_INTERVAL_MS = 60_000;

export interface DraftRecord<T> {
  version: typeof DRAFT_VERSION;
  updatedAt: string;
  value: T;
}

export const draftKeys = {
  sparkCapture: "open-ends:draft:v1:spark-capture:new",
  sparkMain: "open-ends:draft:v1:spark-main:new",
  sparkEdit: (sparkId: string, revision: number) =>
    `open-ends:draft:v1:spark-edit:${sparkId}:${revision}`,
  sparkEditPrefix: (sparkId: string) =>
    `open-ends:draft:v1:spark-edit:${sparkId}:`,
  readingNew: "open-ends:draft:v1:reading:new",
  mediaSearch: "open-ends:draft:v1:media:search",
} as const;

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function serialized<T>(value: T) {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export function readDraftRecord<T>(
  key: string,
  now = Date.now(),
): DraftRecord<T> | null {
  const store = storage();
  if (!store) return null;
  let parsed: unknown;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    store.removeItem(key);
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    store.removeItem(key);
    return null;
  }
  const record = parsed as Partial<DraftRecord<T>>;
  const updatedAt = Date.parse(String(record.updatedAt ?? ""));
  if (
    record.version !== DRAFT_VERSION ||
    !Number.isFinite(updatedAt) ||
    updatedAt > now + 5 * 60 * 1000 ||
    now - updatedAt > DRAFT_MAX_AGE_MS
  ) {
    store.removeItem(key);
    return null;
  }
  return record as DraftRecord<T>;
}

export function readDraft<T>(key: string, now = Date.now()): T | null {
  return readDraftRecord<T>(key, now)?.value ?? null;
}

export function writeDraft<T>(
  key: string,
  value: T,
  now = new Date().toISOString(),
) {
  const store = storage();
  if (!store) return false;
  try {
    const record: DraftRecord<T> = { version: DRAFT_VERSION, updatedAt: now, value };
    store.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string) {
  storage()?.removeItem(key);
}

export function clearDrafts(prefix: string) {
  const store = storage();
  if (!store) return;
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => store.removeItem(key));
}

export interface DraftRestoreGuard {
  consume(restoredValue: unknown | null, canRestore: boolean): boolean;
  markUserEdited(): void;
}

export function createDraftRestoreGuard(): DraftRestoreGuard {
  let consumed = false;
  let userEdited = false;

  return {
    consume(restoredValue, canRestore) {
      if (restoredValue === null || consumed) return false;
      consumed = true;
      return canRestore && !userEdited;
    },
    markUserEdited() {
      userEdited = true;
    },
  };
}

export interface DraftAutosaveOptions<T> {
  intervalMs?: number;
  shouldSave?: (value: T) => boolean;
}

export interface DraftAutosaveController<T> {
  flush(value: T): boolean;
  start(getValue: () => T): () => void;
  clear(): void;
}

const defaultShouldSave = <T,>(value: T) =>
  typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;

export function createDraftAutosaveController<T>(
  key: string,
  { intervalMs = DRAFT_AUTOSAVE_INTERVAL_MS, shouldSave = defaultShouldSave }: DraftAutosaveOptions<T> = {},
): DraftAutosaveController<T> {
  let lastSerialized = serialized(readDraft<T>(key));
  let timer: ReturnType<typeof setInterval> | undefined;

  const flush = (value: T) => {
    if (!shouldSave(value)) return false;
    const next = serialized(value);
    if (next === undefined || next === lastSerialized) return false;
    if (!writeDraft(key, value)) return false;
    lastSerialized = next;
    return true;
  };

  return {
    flush,
    start(getValue) {
      timer = setInterval(() => flush(getValue()), intervalMs);
      const flushWhenHidden = () => {
        if (typeof document === "undefined" || document.visibilityState === "hidden") flush(getValue());
      };
      const flushOnPageHide = () => flush(getValue());
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", flushWhenHidden);
      if (typeof window !== "undefined") window.addEventListener("pagehide", flushOnPageHide);
      return () => {
        if (timer) clearInterval(timer);
        timer = undefined;
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", flushWhenHidden);
        if (typeof window !== "undefined") window.removeEventListener("pagehide", flushOnPageHide);
      };
    },
    clear() {
      clearDraft(key);
      lastSerialized = undefined;
    },
  };
}

export function useDraftAutosave<T>(
  key: string,
  value: T,
  options: DraftAutosaveOptions<T> = {},
) {
  const [restoredValue, setRestoredValue] = useState<T | null>(() => readDraft<T>(key));
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  const controllerRef = useRef<DraftAutosaveController<T> | undefined>(undefined);

  useEffect(() => {
    valueRef.current = value;
    optionsRef.current = options;
  }, [options, value]);

  useEffect(() => {
    let active = true;
    const restored = readDraft<T>(key);
    queueMicrotask(() => {
      if (active) setRestoredValue(restored);
    });
    const controller = createDraftAutosaveController(key, optionsRef.current);
    controllerRef.current = controller;
    const stop = controller.start(() => valueRef.current);
    return () => {
      active = false;
      stop();
      if (controllerRef.current === controller) controllerRef.current = undefined;
    };
  }, [key]);

  const clear = useCallback(() => {
    controllerRef.current?.clear();
    if (!controllerRef.current) clearDraft(key);
    setRestoredValue(null);
  }, [key]);
  const flush = useCallback(() => {
    return controllerRef.current?.flush(valueRef.current) ?? false;
  }, []);

  return { restoredValue, restored: restoredValue !== null, clearDraft: clear, flushDraft: flush };
}
