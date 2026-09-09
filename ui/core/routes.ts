export type MainRouteId =
  | "today"
  | "spark"
  | "month"
  | "open"
  | "review"
  | "reading"
  | "media"
  | "settings";

export const MAIN_ROUTES = {
  today: "/today",
  spark: "/spark",
  month: "/month",
  open: "/open",
  review: "/review",
  reading: "/reading",
  media: "/media",
  settings: "/settings",
} as const satisfies Record<MainRouteId, `/${string}`>;

export const MAIN_ROUTE_IDS = Object.keys(MAIN_ROUTES) as MainRouteId[];

export const AUXILIARY_ROUTES = {
  todoPanel: "/todo-panel",
  sparkCapture: "/spark-capture",
} as const;

export type AuxiliaryRouteId = keyof typeof AUXILIARY_ROUTES;

function normalizePath(path: string | null | undefined) {
  if (!path || path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

export function mainRouteIdFromPath(path: string | null | undefined): MainRouteId | undefined {
  const normalized = normalizePath(path);
  return MAIN_ROUTE_IDS.find(routeId => MAIN_ROUTES[routeId] === normalized);
}

export function auxiliaryRouteIdFromPath(path: string | null | undefined): AuxiliaryRouteId | undefined {
  const normalized = normalizePath(path);
  if (normalized === AUXILIARY_ROUTES.todoPanel) return "todoPanel";
  if (normalized === AUXILIARY_ROUTES.sparkCapture) return "sparkCapture";
  return undefined;
}

export function isAuxiliaryRoute(path: string | null | undefined) {
  return auxiliaryRouteIdFromPath(path) !== undefined;
}
