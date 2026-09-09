"use client";

export interface WindowControlLabels {
  minimize: string;
  maximize: string;
  close: string;
}

export function windowControlLabels(maximized: boolean): WindowControlLabels {
  return {
    minimize: "最小化窗口",
    maximize: maximized ? "恢复窗口" : "最大化窗口",
    close: "关闭到托盘",
  };
}

export function WindowControls({ maximized, onMinimize, onMaximize, onClose }: { maximized: boolean; onMinimize: () => void; onMaximize: () => void; onClose: () => void }) {
  const labels = windowControlLabels(maximized);
  return (
    <div className="desktop-window-controls" onMouseDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <button type="button" className="desktop-window-control desktop-window-control-minimize" onClick={onMinimize} aria-label={labels.minimize}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
      </button>
      <button type="button" className="desktop-window-control desktop-window-control-maximize" onClick={onMaximize} aria-label={labels.maximize}>
        {maximized ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5h7v7h-7zM3.5 10.5h-1v-7h7v1" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx=".7" /></svg>}
      </button>
      <button type="button" className="desktop-window-control desktop-window-control-close" onClick={onClose} aria-label={labels.close}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  );
}
