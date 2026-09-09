"use client";

import { Card } from "@/components/ui/Card";
import { useAppearance } from "@/ui/appearance/AppearanceProvider";
import {SelectMenu} from "@/components/ui/SelectMenu";

export function AppearanceSettings() {
  const { settings, availableEditions, availableThemes, fallbackReasons, setEdition, setTheme } = useAppearance();
  const edition = availableEditions.find(item => item.id === settings.editionId);
  const theme = availableThemes.find(item => item.manifest.id === settings.themeId);

  return (
    <Card className="setting-card appearance-settings-card">
      <span className="tiny-label">Appearance</span>
      <h2>界面体验</h2>
      <p className="muted">外观设置只影响界面呈现，不会写入任务、闪念或回顾事实。</p>
      <div className="appearance-settings-grid">
        <AppearanceChoice label="体验版本 / Edition" value={edition?.name ?? settings.editionId} options={availableEditions.map(item => [item.id, item.name] as const)} onChange={setEdition} />
        <AppearanceChoice label="皮肤 / Theme" value={theme?.manifest.name ?? settings.themeId} options={availableThemes.map(item => [item.manifest.id, item.manifest.name] as const)} onChange={setTheme} />
      </div>
      {fallbackReasons.length > 0 && <p className="appearance-fallback" role="status">保存的部分外观设置暂不可用，已使用安全默认值；原设置仍会保留。</p>}
    </Card>
  );
}

function AppearanceChoice({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  if (options.length <= 1) {
    return <div className="appearance-choice"><span className="label">{label}<strong>{value}</strong></span></div>;
  }
  const selected = options.find(([key]) => key === value)?.[0] ?? options[0][0];
  return <div className="appearance-choice"><SelectMenu label={label} value={selected} onChange={onChange} options={options.map(([value,optionLabel])=>({value,label:optionLabel}))}/></div>;
}
