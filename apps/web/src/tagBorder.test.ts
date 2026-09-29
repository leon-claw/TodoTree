import { describe, expect, it } from 'vitest';
import { getTagBorderStyle } from './tagBorder';

describe('getTagBorderStyle', () => {
  it('leaves untagged nodes to their normal state border', () => {
    expect(getTagBorderStyle([])).toEqual({});
  });

  it('uses a single tag color for the node border', () => {
    expect(getTagBorderStyle(['#336699'])).toEqual({
      borderColor: '#336699',
      borderWidth: '2px',
    });
  });

  it('returns border-only gradient stops for multiple tag colors', () => {
    expect(getTagBorderStyle(['#ff0000', '#0000ff'])).toEqual({
      borderColor: 'transparent',
      borderWidth: '2px',
      gradientStops: [
        { offset: '0%', color: '#ff0000' },
        { offset: '50%', color: '#ff0000' },
        { offset: '50%', color: '#0000ff' },
        { offset: '100%', color: '#0000ff' },
      ],
    });
  });
});
