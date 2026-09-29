export interface TagBorderStyle {
  borderColor?: string;
  borderWidth?: string;
  gradientStops?: Array<{ offset: string; color: string }>;
}

export function getTagBorderStyle(colors: readonly string[]): TagBorderStyle {
  if (colors.length === 0) return {};

  if (colors.length === 1) {
    return { borderColor: colors[0], borderWidth: '2px' };
  }

  const bandWidth = 100 / colors.length;
  const gradientStops = colors.flatMap((color, index) => {
    const start = Number((index * bandWidth).toFixed(3));
    const end = Number(((index + 1) * bandWidth).toFixed(3));
    return [
      { offset: `${start}%`, color },
      { offset: `${end}%`, color },
    ];
  });

  return {
    borderColor: 'transparent',
    borderWidth: '2px',
    gradientStops,
  };
}
