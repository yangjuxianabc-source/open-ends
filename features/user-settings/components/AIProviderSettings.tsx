"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import type {CredentialStatus} from "@/lib/desktop/tauri-client";
import {DEEPSEEK_REQUEST_DEFAULTS} from "@/lib/ai/deepseek";
import {deleteDeepSeekKey,getDeepSeekStatus,providerAvailable,saveDeepSeekKey} from "../services/provider";

export function AIProviderSettings(){
  const [status,setStatus]=useState<CredentialStatus>();const [key,setKey]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [desktop,setDesktop]=useState(false);const [confirmOpen,setConfirmOpen]=useState(false);
  useEffect(()=>{Promise.resolve().then(()=>{const available=providerAvailable();setDesktop(available);if(!available){setStatus({configured:false,model:DEEPSEEK_REQUEST_DEFAULTS.model});return}return getDeepSeekStatus().then(setStatus).catch(error=>setMessage(errorText(error)))})},[]);
  async function save(event:React.FormEvent){event.preventDefault();if(!key.trim()||!desktop)return;setBusy(true);setMessage("");try{const next=await saveDeepSeekKey(key);setKey("");setStatus(next);setMessage(next.verification==="verified"?"密钥已保存到 Windows Credential Manager 并验证。":"密钥已安全保存；DeepSeek 暂时无法验证，调用时会再次尝试。")}catch(error){setMessage(errorText(error))}finally{setBusy(false)}}
  async function remove(){if(!desktop||busy)return;setBusy(true);try{setStatus(await deleteDeepSeekKey());setMessage("密钥已删除。")}catch(error){setMessage(errorText(error))}finally{setBusy(false)}}
  return <><Card className="setting-card ai-provider-card"><span className="tiny-label">DeepSeek AI</span><h2>AI 服务</h2><p className="muted">长期密钥由 Windows Credential Manager 保管。前端只能查询配置状态或提交新密钥，无法读取已保存的明文，也不会把密钥放进 SQLite、浏览器存储或备份。</p>
    <p className="provider-config-note">默认模型：DeepSeek V4 Flash（{DEEPSEEK_REQUEST_DEFAULTS.model}） · 思考模式：关闭</p>
    {!desktop&&<p className="provider-warning">浏览器开发预览不能配置桌面安全凭据；请在 Open Ends 桌面应用中打开设置。</p>}
    <div className="provider-status"><span className={`status-dot ${status?.configured?"ready":""}`}/><strong>{status?.configured?(status.verification==="verified"?"已配置并验证":"已配置，待验证"):"尚未配置"}</strong>{status?.updatedAt&&<time>{new Date(status.updatedAt).toLocaleString("zh-CN")}</time>}</div>
    <form className="provider-form" onSubmit={save}><input className="field" type="password" autoComplete="new-password" value={key} onChange={event=>setKey(event.target.value)} placeholder={status?.configured?"输入新密钥以更新":"输入 DeepSeek API Key"} aria-label="DeepSeek API Key" disabled={!desktop}/><Button disabled={!desktop||busy||!key.trim()}>{busy?"处理中…":status?.configured?"更新密钥":"保存密钥"}</Button>{status?.configured&&<Button type="button" variant="danger" onClick={()=>setConfirmOpen(true)} disabled={busy}>删除</Button>}</form>
    {message&&<p className="backup-message muted">{message}</p>}<p className="security-note">DeepSeek 请求由 Rust 从安全凭据读取 Key 后发出；响应与日志不会包含 Key。</p></Card><ConfirmDialog open={confirmOpen} title="删除 DeepSeek API Key？" description="保存于 Windows Credential Manager 的密钥将被删除，之后需要重新配置才能使用 AI。" confirmLabel="删除密钥" busy={busy} onCancel={()=>setConfirmOpen(false)} onConfirm={()=>{setConfirmOpen(false);void remove()}} /></>
}

function errorText(error:unknown){const code=error instanceof Error?error.message:String(error);return ({INVALID_API_KEY:"DeepSeek 拒绝了这个密钥，请检查后重试。",CREDENTIAL_EMPTY:"密钥不能为空。",DESKTOP_RUNTIME_REQUIRED:"此操作只在桌面应用中可用。"} as Record<string,string>)[code]??`保存失败：${code}`}
