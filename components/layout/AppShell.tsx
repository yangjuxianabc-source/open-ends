"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { listenDesktopNavigation } from "@/lib/desktop/tauri-client";
import { WindowChrome } from "./WindowChrome";
import type { EditionShellProps } from "@/ui/editions/contracts";

export function AppShell({ children, application, navigation }: EditionShellProps) {
  const router = useRouter();
  const { storageKind, error, ready, migration } = application;
  useEffect(() => {
    let unlisten = () => {};
    listenDesktopNavigation(route => router.push(route)).then(dispose => { unlisten = dispose; });
    return () => unlisten();
  }, [router]);

  return (
    <WindowChrome kind="main">
      <div className="shell">
        <div className="hide-mobile"><Sidebar navigation={navigation} /></div>
        <main>
          <div className="main-system-row">
            {migration.status !== "idle" && <div className={`migration-notice migration-${migration.status}`} role={migration.status === "failed" ? "alert" : "status"}><strong>{migration.status === "running" ? "正在迁移旧版数据" : migration.status === "completed" ? "旧版数据迁移完成" : "旧版数据迁移失败"}</strong><span>{migration.message}</span>{migration.backupPath && <small>备份：{migration.backupPath}</small>}</div>}
            {storageKind === "browser-preview" && <div className="migration-notice preview-notice" role="status"><strong>浏览器开发预览</strong><span>正式桌面数据源为 SQLite；此页面使用独立预览存储，不会覆盖桌面数据库。</span></div>}
            {ready && !storageKind && error && <div className="migration-notice migration-failed" role="alert"><strong>本地数据存储不可用</strong><span>{error}</span></div>}
          </div>
          <div className="main-screen">{children}</div>
        </main>
        <div className="hide-desktop"><Sidebar mobile navigation={navigation} /></div>
      </div>
    </WindowChrome>
  );
}
