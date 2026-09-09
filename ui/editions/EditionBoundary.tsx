"use client";

import { usePathname } from "next/navigation";
import { WindowChrome } from "@/components/layout/WindowChrome";
import { useOpenEndsUI } from "@/ui/core/ui-bridge";
import { auxiliaryRouteIdFromPath, mainRouteIdFromPath } from "@/ui/core/routes";
import { useAppearance } from "@/ui/appearance/AppearanceProvider";

export function EditionBoundary({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { edition } = useAppearance();
  const { application } = useOpenEndsUI();
  const auxiliaryRoute = auxiliaryRouteIdFromPath(path);

  if (auxiliaryRoute === "todoPanel") {
    const Renderer = edition.auxiliaryRenderers.todoPanel;
    return <WindowChrome kind="todo"><Renderer application={application} /></WindowChrome>;
  }
  if (auxiliaryRoute === "sparkCapture") {
    const Renderer = edition.auxiliaryRenderers.sparkCapture;
    return <WindowChrome kind="spark"><Renderer application={application} /></WindowChrome>;
  }

  const Shell = edition.Shell;
  return <Shell application={application} navigation={edition.navigation} routeId={mainRouteIdFromPath(path) ?? edition.homeRoute}>{children}</Shell>;
}
