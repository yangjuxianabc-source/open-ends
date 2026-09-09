export type SparkWorkspaceMode = "browsing" | "detail";

export function sparkWorkspaceMode(selectedId?: string): SparkWorkspaceMode {
  return selectedId ? "detail" : "browsing";
}
