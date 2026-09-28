export type SemanticZoomLevel = 'detail' | 'compact' | 'overview';

export const DETAIL_ZOOM_THRESHOLD = 0.85;
export const COMPACT_ZOOM_THRESHOLD = 0.55;
export const READING_ZOOM = 0.95;

export function getSemanticZoomLevel(zoom: number): SemanticZoomLevel {
  if (zoom >= DETAIL_ZOOM_THRESHOLD) return 'detail';
  if (zoom >= COMPACT_ZOOM_THRESHOLD) return 'compact';
  return 'overview';
}

export type InitialFlowViewport =
  | { kind: 'fit' }
  | { kind: 'focus'; focusId: string; zoom: number };

export function getInitialFlowViewport(
  fittedZoom: number,
  selectedId: string | null,
  firstRootId: string | null,
): InitialFlowViewport {
  if (fittedZoom >= DETAIL_ZOOM_THRESHOLD) return { kind: 'fit' };
  const focusId = selectedId ?? firstRootId;
  if (!focusId) return { kind: 'fit' };
  return { kind: 'focus', focusId, zoom: READING_ZOOM };
}
