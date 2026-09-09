"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { MonthlyReportExport } from "@/features/export/components/MonthlyReportExport";
import { BackupSection } from "@/features/export/components/BackupSection";
import { AIProviderSettings } from "./AIProviderSettings";
import { TMDBProviderSettings } from "./TMDBProviderSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { DesktopSettings } from "@/features/desktop-shell/components/DesktopSettings";
import { PageLead } from "@/components/ui/PageLead";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";

const settingsSections = [
  { id: "privacy", label: "基础与隐私", icon: "◈" },
  { id: "appearance", label: "界面体验", icon: "□" },
  { id: "providers", label: "AI 与匹配服务", icon: "✦" },
  { id: "desktop", label: "桌面与数据", icon: "▣" },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]["id"];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("privacy");

  function selectSection(id: SettingsSectionId) {
    setActiveSection(id);
  }

  return (
    <ClassicPageScaffold
      lead={<PageLead title="设置" slogan="把应用调整成适合你的样子。" />}
      contentClassName="page settings-page"
    >
      <nav className="settings-tabs" aria-label="设置分类">
        {settingsSections.map(section => <a key={section.id} href={`#settings-${section.id}`} className={activeSection === section.id ? "active" : ""} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => selectSection(section.id)}>{section.label}</a>)}
      </nav>

      <div className="settings-sections">
        <section id="settings-privacy" className="settings-section">
          <SettingsSectionHeading index="1" icon="◈" title="基础与隐私" />
          <div className="settings-section-body">
            <Card className="setting-card settings-inner-card">
              <span className="tiny-label">Privacy</span>
              <h2>本地模式</h2>
              <p className="muted">正式桌面版将任务、事件、回顾和阅读对象保存在本机 SQLite，不会上传到 Open Ends 服务器。只有你主动使用 AI 时，必要证据才会发送给所选服务；1.0 不提供账号或云同步。</p>
            </Card>
          </div>
        </section>

        <section id="settings-appearance" className="settings-section">
          <SettingsSectionHeading index="2" icon="□" title="界面体验" />
          <div className="settings-section-body">
            <AppearanceSettings />
          </div>
        </section>

        <section id="settings-providers" className="settings-section">
          <SettingsSectionHeading index="3" icon="✦" title="AI 与匹配服务" />
          <div className="settings-section-body settings-provider-stack">
            <AIProviderSettings />
            <TMDBProviderSettings />
          </div>
        </section>

        <section id="settings-desktop" className="settings-section">
          <SettingsSectionHeading index="4" icon="▣" title="桌面与数据" />
          <div className="settings-section-body settings-desktop-stack">
            <DesktopSettings />
            <div className="settings-backup-grid"><BackupSection /></div>
            <MonthlyReportExport />
          </div>
        </section>
      </div>
    </ClassicPageScaffold>
  );
}

function SettingsSectionHeading({ index, icon, title }: { index: string; icon: string; title: string }) {
  return <header className="settings-section-heading"><span className="settings-section-icon" aria-hidden="true">{icon}</span><span className="settings-section-index">{index}.</span><h2>{title}</h2></header>;
}
