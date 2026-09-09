"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { isDesktopRuntime, writeDataBackup } from "@/lib/desktop/tauri-client";
import { mergeStores } from "@/lib/storage/merge";
import { parseStoreBackup, serializeStoreBackup, type StoreData } from "@/lib/storage/migrate";
import { useOpenEnds } from "@/lib/storage/store";
import { SelectMenu } from "@/components/ui/SelectMenu";

type ImportMode = "merge" | "replace";

export function BackupSection() {
  const { data, ready, restore, clearAllData } = useOpenEnds();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [clearing, setClearing] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<{ data: StoreData; fileName: string }>();
  const [confirmClear, setConfirmClear] = useState(false);

  async function exportJson() {
    const contents = serializeStoreBackup(data);
    if (isDesktopRuntime()) {
      try {
        const path = await writeDataBackup(contents, true);
        setMessage(`桌面备份已保存：${path}`);
      } catch (error) {
        setMessage(`桌面备份保存失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `open-ends-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const next = await parseStoreBackup(String(reader.result ?? ""));
      if (!next) {
        setMessage("导入失败：文件不是有效的 Open Ends JSON 备份，当前数据未改变。");
        return;
      }
      if (importMode === "replace") {
        setPendingReplace({ data: next, fileName: file.name });
        return;
      }
      const result = mergeStores(data, next);
      restore(result.data);
      const { summary } = result;
      setMessage(`已合并 ${file.name}：新增 ${summary.tasksAdded} 条任务、${summary.readingItemsAdded} 个阅读对象、${summary.mediaItemsAdded} 个影视对象、${summary.taskEventsAdded} 条任务历史；当前共 ${result.data.tasks.length} 条任务。`);
    };
    reader.onerror = () => setMessage("导入失败：无法读取文件，当前数据未改变。");
    reader.readAsText(file);
  }

  function clearAll() {
    if (!clearing) setConfirmClear(true);
  }

  async function performClear() {
    if (clearing) return;
    setClearing(true);
    setMessage(null);
    try {
      await clearAllData();
      setMessage("已清空所有本地数据。用户设置和桌面凭据未改变。");
    } catch (error) {
      setMessage(`清空失败：${error instanceof Error ? error.message : String(error)}。当前数据未确认清空，请重启应用后检查。`);
    } finally {
      setClearing(false);
    }
  }

  function confirmPendingAction() {
    if (pendingReplace) {
      const pending = pendingReplace;
      setPendingReplace(undefined);
      restore(pending.data);
      setMessage(`已覆盖导入 ${pending.fileName}：${pending.data.tasks.length} 条任务、${pending.data.readingItems.length} 个阅读对象。`);
      return;
    }
    if (confirmClear) {
      setConfirmClear(false);
      void performClear();
    }
  }

  const confirmMode = pendingReplace ? "replace" : confirmClear ? "clear" : undefined;

  return <>
    <Card className="backup-card">
      <h2>数据备份</h2>
      <p className="muted">导出完整数据为 JSON。导入默认合并；只有主动选择覆盖时才替换当前数据。</p>
      <div className="row"><Button variant="secondary" onClick={exportJson} disabled={!ready}>保存并下载全部数据</Button></div>
      <div className="backup-import">
        <SelectMenu label="导入方式" value={importMode} onChange={value => setImportMode(value as ImportMode)} options={[{ value: "merge", label: "合并导入（保留现有数据）" }, { value: "replace", label: "覆盖导入（替换现有数据）" }]} />
        {importMode === "replace" && <p className="import-warning">覆盖导入会替换当前数据库，请先导出当前备份。</p>}
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={!ready}>选择 JSON 文件并导入</Button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={onFile} className="sr-only" />
      </div>
      {message && <p className="muted backup-message">{message}</p>}
    </Card>
    <Card className="backup-card data-management-card">
      <h2>数据管理</h2>
      <p className="muted">清空本机保存的任务、闪念、阅读、影视和回顾画像数据。用户设置和桌面凭据会保留。</p>
      <div className="row"><Button variant="danger" onClick={clearAll} disabled={!ready || clearing}>{clearing ? "清空中…" : "清空所有本地数据"}</Button></div>
    </Card>
    <ConfirmDialog
      open={Boolean(confirmMode)}
      title={confirmMode === "replace" ? "覆盖导入当前数据？" : "清空所有本地数据？"}
      description={confirmMode === "replace" ? "当前数据库中的数据将被备份文件替换，建议先导出一份当前备份。" : "任务、闪念、阅读、影视和 Review/Profile 数据将被删除，无法恢复；用户设置和桌面凭据会保留。"}
      confirmLabel={confirmMode === "replace" ? "覆盖导入" : "清空数据"}
      busy={clearing}
      onCancel={() => { setPendingReplace(undefined); setConfirmClear(false); }}
      onConfirm={confirmPendingAction}
    />
  </>;
}
