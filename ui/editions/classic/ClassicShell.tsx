import { AppShell } from "@/components/layout/AppShell";
import type { EditionShellProps } from "../contracts";

export function ClassicShell({ children, routeId, application, navigation }: EditionShellProps) {
  return <AppShell routeId={routeId} application={application} navigation={navigation}>{children}</AppShell>;
}
