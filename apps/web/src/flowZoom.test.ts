import { describe, expect, it } from 'vitest';
import { getInitialFlowViewport, getSemanticZoomLevel } from './flowZoom';

describe('getSemanticZoomLevel', () => {
  it('uses detail at and above the 85% threshold', () => {
    expect(getSemanticZoomLevel(0.85)).toBe('detail');
    expect(getSemanticZoomLevel(1)).toBe('detail');
  });

  it('uses compact from 55% up to but not including 85%', () => {
    expect(getSemanticZoomLevel(0.55)).toBe('compact');
    expect(getSemanticZoomLevel(0.849)).toBe('compact');
  });

  it('uses overview below 55%', () => {
    expect(getSemanticZoomLevel(0.549)).toBe('overview');
    expect(getSemanticZoomLevel(0.2)).toBe('overview');
  });
});

describe('getInitialFlowViewport', () => {
  it('keeps a fitting tree visible when it can be read at 85%', () => {
    expect(getInitialFlowViewport(0.85, 'selected', 'root')).toEqual({ kind: 'fit' });
    expect(getInitialFlowViewport(1.1, null, 'root')).toEqual({ kind: 'fit' });
  });

  it('focuses the selected task at a readable scale when the full tree is smaller', () => {
    expect(getInitialFlowViewport(0.84, 'selected', 'root')).toEqual({
      kind: 'focus',
      focusId: 'selected',
      zoom: 0.95,
    });
  });

  it('focuses the first root when no task is selected', () => {
    expect(getInitialFlowViewport(0.4, null, 'root')).toEqual({
      kind: 'focus',
      focusId: 'root',
      zoom: 0.95,
    });
  });

  it('falls back to fit if there is no focus target', () => {
    expect(getInitialFlowViewport(0.4, null, null)).toEqual({ kind: 'fit' });
  });
});
