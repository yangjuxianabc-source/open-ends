"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { EditionIcon } from "@/ui/themes/EditionIcon";
import { MAIN_ROUTES, mainRouteIdFromPath } from "@/ui/core/routes";
import type { EditionNavigationItem } from "@/ui/editions/contracts";
import { isDesktopRuntime, startCurrentWindowDragging } from "@/lib/desktop/tauri-client";

export function Sidebar({ mobile = false, navigation }: { mobile?: boolean; navigation: readonly EditionNavigationItem[] }) {
  const path = usePathname();
  const activeRoute = mainRouteIdFromPath(path);
  const groups = Array.from(new Set(navigation.map(item => item.group))).map(group => ({
    label: group,
    links: navigation.filter(item => item.group === group),
  }));

  function handleSidebarMouseDown(event: React.MouseEvent<HTMLElement>) {
    if (mobile || !isDesktopRuntime() || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a,button,input,textarea,select,[role='button'],[role='option'],.settings-link,.nav-group-label,.quote,.brand")) return;
    if (window.getSelection()?.toString()) return;
    event.preventDefault();
    void startCurrentWindowDragging();
  }

  return (
    <nav className={mobile ? "bottom-nav" : "sidebar"} aria-label="主要导航" onMouseDown={handleSidebarMouseDown}>
      {!mobile && (
        <div className="brand">
          <BrandMark />
          <div>
            <strong>未了</strong>
            <small>Open Ends</small>
          </div>
        </div>
      )}
      <div className={mobile ? "bottom-links" : "nav-links"}>
        {mobile
          ? navigation.map(item => <NavItem key={item.id} item={item} active={activeRoute === item.id} />)
          : groups.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.links.map(item => <NavItem key={item.id} item={item} active={activeRoute === item.id} />)}
            </div>
          ))}
      </div>
      {!mobile && (
        <div className="sidebar-footer">
          <Link href={MAIN_ROUTES.settings} className={`settings-link ${activeRoute === "settings" ? "active" : ""}`} aria-label="设置" aria-current={activeRoute === "settings" ? "page" : undefined} title="设置"><EditionIcon slot="settings"/><span>设置</span></Link>
          <div className="quote"><span className="quote-mark" aria-hidden="true">“</span><span className="quote-copy">重要的不是把所有事情做完，<br />而是知道今天为何值得被记住。</span></div>
        </div>
      )}
    </nav>
  );
}

function NavItem({ item, active }: { item: EditionNavigationItem; active: boolean }) {
  return (
    <Link href={MAIN_ROUTES[item.id]} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
      <EditionIcon slot={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}
