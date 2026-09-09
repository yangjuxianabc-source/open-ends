"use client";

import { useAppearance } from "@/ui/appearance/AppearanceProvider";
import type { MainRouteId } from "@/ui/core/routes";

export function EditionRoute({ routeId }: { routeId: MainRouteId }) {
  const { edition } = useAppearance();
  const Screen = edition.screens[routeId] ?? edition.screens[edition.homeRoute];
  return Screen ? <Screen routeId={routeId} /> : <p className="muted">这个页面暂时还没有对应的 Edition 页面。</p>;
}
