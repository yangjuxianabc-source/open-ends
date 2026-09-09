"use client";

import { useOpenEnds, type MigrationState } from "@/lib/storage/store";

export interface ApplicationUIState {
  ready: boolean;
  storageKind?: "sqlite" | "browser-preview";
  error?: string;
  migration: MigrationState;
}

/**
 * Presentation code uses this bridge instead of reaching through to the
 * repository or directly invoking Tauri commands. Existing feature screens
 * may continue using useOpenEnds while they are being adapted.
 */
export function useOpenEndsUI() {
  const store = useOpenEnds();
  const { data, ready, storageKind, error, migration, ...actions } = store;

  return {
    data,
    application: { ready, storageKind, error, migration } satisfies ApplicationUIState,
    actions,
  };
}
