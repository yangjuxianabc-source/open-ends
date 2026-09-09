"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DesktopTitlebar } from "@/components/desktop/DesktopTitlebar";
import { isDesktopRuntime,showDesktopWindow,startCurrentWindowDragging } from "@/lib/desktop/tauri-client";

export type WindowKind = "main" | "todo" | "spark";

export interface WindowChromeProps {
  children: ReactNode;
  kind: WindowKind;
}

/**
 * Owns the outer frame for every exported route. Desktop windows share the
 * same custom chrome; browser previews keep the auxiliary routes lightweight.
 */
export function WindowChrome({ children, kind }: WindowChromeProps) {
  // Keep the server snapshot identical to static export; the client snapshot
  // switches to Tauri after hydration without producing a markup mismatch.
  const desktop = useSyncExternalStore(() => () => {}, isDesktopRuntime, () => false);
  const isMainWindow = kind === "main";
  const renderTitlebar = isMainWindow;

  useEffect(() => {
    document.documentElement.classList.toggle("tauri-window", desktop);
    return () => document.documentElement.classList.remove("tauri-window");
  }, [desktop]);

  useEffect(() => {
    const title = kind === "todo" ? "今天" : kind === "spark" ? "新建闪念" : "未了 Open Ends";
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };

    applyTitle();
    // Next's metadata head can reconcile after this client effect. Keep the
    // auxiliary window labels stable when that happens.
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [kind]);

  const windowClass = [
    "window-frame",
    `window-frame-${kind}`,
    desktop ? "is-desktop" : "",
    isMainWindow ? "tauri-main-window" : "tauri-auxiliary-window",
  ].filter(Boolean).join(" ");

  function auxiliaryPointerDown(event:React.MouseEvent<HTMLDivElement>){
    if(!desktop||isMainWindow||event.button!==0)return;
    const target=event.target as HTMLElement;
    if(target.closest("button,a,input,textarea,select,[role='button'],[role='option']"))return;
    void startCurrentWindowDragging();
  }

  function auxiliaryDoubleClick(event:React.MouseEvent<HTMLDivElement>){
    if(!desktop||kind!=="todo")return;
    const target=event.target as HTMLElement;
    if(target.closest("button,a,input,textarea,select,[role='button'],[role='option']"))return;
    void showDesktopWindow("main","/today");
  }

  return (
    <div className={windowClass} data-window-kind={kind} onMouseDown={auxiliaryPointerDown} onDoubleClick={auxiliaryDoubleClick}>
      {renderTitlebar ? <DesktopTitlebar kind={kind} desktop={desktop} /> : null}
      <div className="window-content">{children}</div>
    </div>
  );
}
