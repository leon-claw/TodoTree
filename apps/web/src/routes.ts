import { ActiveTab, AppRoute } from './types';

const APP_ROUTES: AppRoute[] = ['/graph', '/list', '/settings', '/settings/tags'];

export function parseAppRoute(pathname: string): AppRoute | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (normalized === '/') return '/graph';
  if (APP_ROUTES.includes(normalized as AppRoute)) return normalized as AppRoute;
  const detailMatch = /^\/(graph|list)\/todo\/([^/]+)$/.exec(normalized);
  if (!detailMatch) return null;
  try {
    const id = decodeURIComponent(detailMatch[2]);
    if (!id) return null;
    return `/${detailMatch[1]}/todo/${encodeURIComponent(id)}` as AppRoute;
  } catch {
    return null;
  }
}

export function routeForTab(tab: ActiveTab): Exclude<AppRoute, '/settings/tags'> {
  switch (tab) {
    case 'graph': return '/graph';
    case 'list': return '/list';
    case 'settings': return '/settings';
  }
}

export function tabForRoute(route: AppRoute): ActiveTab {
  if (route === '/settings/tags') return 'settings';
  if (route.startsWith('/graph')) return 'graph';
  if (route.startsWith('/list')) return 'list';
  return 'settings';
}

export function todoIdForRoute(route: AppRoute): string | null {
  const match = /^\/(?:graph|list)\/todo\/(.+)$/.exec(route);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function baseRouteFor(route: AppRoute): Exclude<AppRoute, '/settings/tags' | `/graph/todo/${string}` | `/list/todo/${string}`> {
  if (route.startsWith('/graph')) return '/graph';
  if (route.startsWith('/list')) return '/list';
  return '/settings';
}

export function detailRouteFor(tab: 'graph' | 'list', id: string): AppRoute {
  return `/${tab}/todo/${encodeURIComponent(id)}` as AppRoute;
}
