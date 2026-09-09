import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  createDraftAutosaveController,
  createDraftRestoreGuard,
  draftKeys,
  readDraft,
  readDraftRecord,
  writeDraft,
} from "./draft-cache";

describe("draft cache", () => {
  const memory = new Map<string, string>();
  const mock = {
    get length() {
      return memory.size;
    },
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    key: (index: number) => [...memory.keys()][index] ?? null,
    clear: () => memory.clear(),
  };
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    vi.useRealTimers();
    memory.clear();
    (globalThis as { localStorage?: unknown }).localStorage = original;
    if (originalDocument === undefined) Reflect.deleteProperty(globalThis, "document");
    else Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  });

  it("saves at 60 seconds, skips 59 seconds, and does not rewrite unchanged values", () => {
    vi.useFakeTimers();
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    const controller = createDraftAutosaveController<string>(draftKeys.sparkMain);
    let value = "a thought";
    const stop = controller.start(() => value);

    vi.advanceTimersByTime(59_000);
    expect(readDraft(draftKeys.sparkMain)).toBeNull();
    vi.advanceTimersByTime(1_000);
    const first = readDraftRecord<string>(draftKeys.sparkMain);
    expect(first?.value).toBe(value);
    vi.advanceTimersByTime(60_000);
    expect(readDraftRecord<string>(draftKeys.sparkMain)?.updatedAt).toBe(first?.updatedAt);
    value = "a changed thought";
    vi.advanceTimersByTime(60_000);
    expect(readDraft(draftKeys.sparkMain)).toBe(value);
    stop();
  });

  it("recovers recent drafts and discards drafts older than 30 days", () => {
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    const now = Date.parse("2026-08-30T00:00:00.000Z");
    writeDraft(draftKeys.sparkCapture, "recover me", new Date(now - 2_000).toISOString());
    expect(readDraft(draftKeys.sparkCapture, now)).toBe("recover me");
    writeDraft(draftKeys.readingNew, "old", new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString());
    expect(readDraft(draftKeys.readingNew, now)).toBeNull();
  });

  it("flushes pagehide even while the document is still visible", () => {
    vi.useFakeTimers();
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    let pagehide: (() => void) | undefined;
    const documentMock = {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const windowMock = {
      addEventListener: vi.fn((type: string, listener: unknown) => {
        if (type === "pagehide") pagehide = listener as () => void;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(globalThis, "document", { configurable: true, value: documentMock });
    Object.defineProperty(globalThis, "window", { configurable: true, value: windowMock });
    const controller = createDraftAutosaveController<string>(draftKeys.sparkMain);
    let value = "before close";
    const stop = controller.start(() => value);
    value = "flush on pagehide";
    pagehide?.();
    expect(readDraft(draftKeys.sparkMain)).toBe(value);
    stop();
  });

  it("clears a formally saved draft", () => {
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    writeDraft(draftKeys.mediaSearch, { query: "电影" });
    expect(readDraft(draftKeys.mediaSearch)).toEqual({ query: "电影" });
    clearDraft(draftKeys.mediaSearch);
    expect(readDraft(draftKeys.mediaSearch)).toBeNull();
  });

  it("keeps a restored SparkCapture draft empty after the user clears it", () => {
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    writeDraft(draftKeys.sparkCapture, "你好");
    const guard = createDraftRestoreGuard();
    let content = "";
    const restored = readDraft<string>(draftKeys.sparkCapture);

    expect(restored).toBe("你好");
    expect(guard.consume(restored, content === "")).toBe(true);
    content = restored!;

    guard.markUserEdited();
    content = "你";
    expect(guard.consume(restored, content === "")).toBe(false);
    content = "";
    clearDraft(draftKeys.sparkCapture);

    expect(content).toBe("");
    expect(readDraft(draftKeys.sparkCapture)).toBeNull();
    expect(guard.consume(restored, content === "")).toBe(false);
    expect(content).toBe("");
  });

  it("does not consume an empty restore result before a draft arrives", () => {
    const guard = createDraftRestoreGuard();

    expect(guard.consume(null, true)).toBe(false);
    expect(guard.consume("later", true)).toBe(true);
  });

  it("does not overwrite input that was entered before restore", () => {
    const guard = createDraftRestoreGuard();
    guard.markUserEdited();

    expect(guard.consume("new draft", true)).toBe(false);
    expect(guard.consume("new draft", true)).toBe(false);
  });

  it("consumes a restore even when the current value is already non-empty", () => {
    const guard = createDraftRestoreGuard();

    expect(guard.consume("old draft", false)).toBe(false);
    expect(guard.consume("old draft", true)).toBe(false);
  });

  it("allows a new draft to autosave after an explicit clear", () => {
    (globalThis as { localStorage?: unknown }).localStorage = mock;
    writeDraft(draftKeys.sparkCapture, "旧内容");
    const controller = createDraftAutosaveController(draftKeys.sparkCapture);
    controller.clear();

    expect(readDraft(draftKeys.sparkCapture)).toBeNull();
    expect(controller.flush("新的闪念")).toBe(true);
    expect(readDraft(draftKeys.sparkCapture)).toBe("新的闪念");
  });
});
