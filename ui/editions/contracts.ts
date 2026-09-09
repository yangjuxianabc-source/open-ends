import type { ComponentType, ReactNode } from "react";
import type { ApplicationUIState } from "@/ui/core/ui-bridge";
import type { MainRouteId } from "@/ui/core/routes";
import type { IconSlot } from "@/ui/themes/contracts";

export interface EditionNavigationItem {
  id: MainRouteId;
  label: string;
  group: string;
  icon: IconSlot;
}

export interface EditionScreenProps {
  routeId: MainRouteId;
}

export interface EditionShellProps {
  children: ReactNode;
  routeId: MainRouteId;
  application: ApplicationUIState;
  navigation: readonly EditionNavigationItem[];
}

export interface EditionAuxiliaryProps {
  application: ApplicationUIState;
}

export interface EditionAuxiliaryRenderers {
  todoPanel: ComponentType<EditionAuxiliaryProps>;
  sparkCapture: ComponentType<EditionAuxiliaryProps>;
}

export interface EditionDefinition {
  id: string;
  name: string;
  apiVersion: 1;
  defaultThemeId: string;
  supportedThemeIds: string[];
  homeRoute: MainRouteId;
  Shell: ComponentType<EditionShellProps>;
  screens: Partial<Record<MainRouteId, ComponentType<EditionScreenProps>>>;
  navigation: EditionNavigationItem[];
  auxiliaryRenderers: EditionAuxiliaryRenderers;
}
