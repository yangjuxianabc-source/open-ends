"use client";

import { useEffect, useState } from "react";
import {
  hideCurrentWindow,
  isCurrentWindowMaximized,
  minimizeCurrentWindow,
  showDesktopWindow,
  startCurrentWindowDragging,
  toggleMaximizeCurrentWindow,
} from "@/lib/desktop/tauri-client";
import { WindowControls } from "./WindowControls";

export interface DesktopTitlebarProps {
  desktop: boolean;
  kind?: "main" | "todo" | "spark";
}

export function DesktopTitlebar({ desktop, kind = "main" }: DesktopTitlebarProps) {
  const [maximized, setMaximized] = useState(false);
  const compact = kind !== "main";
  const showControls = desktop && kind === "main";

  useEffect(() => {
    if (!showControls) return;
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const next = await isCurrentWindowMaximized();
        if (!disposed) setMaximized(next);
      } catch {
        // A browser preview or a window being torn down should not surface an API error.
      }
    };
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 80);
    };
    void refresh();
    window.addEventListener("resize", scheduleRefresh);
    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, [showControls]);

  useEffect(() => {
    document.documentElement.classList.toggle("window-maximized", showControls && maximized);
    return () => document.documentElement.classList.remove("window-maximized");
  }, [maximized, showControls]);

  async function maximize() {
    if (!showControls) return;
    try {
      setMaximized(await toggleMaximizeCurrentWindow());
    } catch {
      // The next resize event will reconcile the state if Windows is still updating it.
    }
  }

  function startDrag(event: React.MouseEvent<HTMLElement>) {
    if (desktop && event.button === 0 && event.detail === 1) {
      event.preventDefault();
      void beginDesktopTitlebarDrag();
    }
  }

  function handleDoubleClick() {
    if (!desktop) return;
    if (kind === "main") void maximize();
    if (kind === "todo") void showDesktopWindow("main", "/today");
  }

  return (
    <header className={`desktop-titlebar ${compact ? "desktop-titlebar-compact" : ""} ${desktop ? "is-desktop" : ""}`} aria-label="Open Ends 窗口标题栏">
      <div
        className="desktop-titlebar-drag-region"
        onMouseDown={startDrag}
        onDoubleClick={handleDoubleClick}
      />
      {showControls ? <WindowControls maximized={maximized} onMinimize={() => void minimizeCurrentWindow()} onMaximize={() => void maximize()} onClose={() => void hideCurrentWindow()} /> : null}
    </header>
  );
}

export async function beginDesktopTitlebarDrag() {
  await startCurrentWindowDragging();
}
