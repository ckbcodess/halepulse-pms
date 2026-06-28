declare module 'culori' {
  interface Color {
    mode: string;
    [key: string]: any;
  }

  interface Oklch extends Color {
    mode: 'oklch';
    l: number;
    c: number;
    h?: number;
  }

  function parse(color: string): Color | undefined;
  function converter(mode: string): (color: Color) => any;
  function formatCss(color: Color): string;
  function clampChroma(color: Color, mode?: string, rgbGamut?: string): Color;
}
