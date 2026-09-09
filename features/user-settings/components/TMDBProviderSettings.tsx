"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CredentialStatus } from "@/lib/desktop/tauri-client";
import { deleteTmdbToken, getTmdbStatus, saveTmdbToken } from "../services/provider";
import { providerAvailable } from "../services/provider";

export function TMDBProviderSettings() {
  const [status, setStatus] = useState<CredentialStatus>();
  const [token, setToken] = useState("");
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const available = providerAvailable();
      setDesktop(available);
      if (!available) return setStatus({ configured: false });
      return getTmdbStatus().then(setStatus).catch(error => setMessage(errorText(error)));
    });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!desktop || !token.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      setStatus(await saveTmdbToken(token));
      setToken("");
      setMessage("TMDB Token 已保存到 Windows Credential Manager。");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!desktop || busy) return;
    setBusy(true);
    try {
      setStatus(await deleteTmdbToken());
      setMessage("TMDB Token 已删除。");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return <><Card className="setting-card ai-provider-card"><span className="tiny-label">TMDB</span><h2>影视匹配</h2><p className="muted">Spark 识别影视后，只会使用 Token 搜索候选；同名作品必须由你在确认页选择。Token 只保存在 Windows Credential Manager，不会进入 SQLite 或备份。</p><p className="security-note">影视资料与海报来自 TMDB。This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    {!desktop && <p className="provider-warning">浏览器开发预览不能配置桌面安全凭据；请在 Open Ends 桌面应用中打开设置。</p>}
    <div className="provider-status"><span className={`status-dot ${status?.configured ? "ready" : ""}`} /><strong>{status?.configured ? "已配置" : "尚未配置"}</strong>{status?.updatedAt && <time>{new Date(status.updatedAt).toLocaleString("zh-CN")}</time>}</div>
    <form className="provider-form" onSubmit={save}><input className="field" type="password" autoComplete="new-password" value={token} onChange={event => setToken(event.target.value)} placeholder={status?.configured ? "输入新 Token 以更新" : "输入 TMDB API Read Access Token"} aria-label="TMDB Token" disabled={!desktop} /><Button disabled={!desktop || busy || !token.trim()}>{busy ? "处理中…" : status?.configured ? "更新 Token" : "保存 Token"}</Button>{status?.configured && <Button type="button" variant="danger" onClick={()=>setConfirmOpen(true)} disabled={busy}>删除</Button>}</form>
    {message && <p className="backup-message muted">{message}</p>}
  </Card><ConfirmDialog open={confirmOpen} title="删除 TMDB Token？" description="保存于 Windows Credential Manager 的 Token 将被删除，之后需要重新配置才能搜索影视作品。" confirmLabel="删除 Token" busy={busy} onCancel={()=>setConfirmOpen(false)} onConfirm={()=>{setConfirmOpen(false);void remove()}} /></>;
}

function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  return ({ CREDENTIAL_EMPTY: "Token 不能为空。", DESKTOP_RUNTIME_REQUIRED: "此操作只在桌面应用中可用。", CREDENTIAL_KIND_NOT_ALLOWED: "不支持的凭据类型。" } as Record<string, string>)[code] ?? `保存失败：${code}`;
}
