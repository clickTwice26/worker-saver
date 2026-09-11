/**
 * Material 3 colour, generated rather than hand-picked.
 *
 * Every value below comes out of HCT tonal palettes derived from a seed colour
 * by `@material/material-color-utilities` — the same library the Material Theme
 * Builder uses. Picking hexes by eye produces a palette that merely looks
 * Material; deriving tones produces one that behaves like it, with the contrast
 * relationships between a role and its `on-` pair guaranteed by construction.
 *
 * Light scheme reads tones 40/100/90/10 for a colour role; dark reads 80/20/30/90.
 */

import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  type TonalPalette,
} from '@material/material-color-utilities';

/** Seed. Industrial blue — the product's existing identity, re-derived in HCT. */
const SEED = '#1E40AF';

/**
 * Risk bands are their own colour roles, not decoration.
 *
 * `blend: false` keeps each hue where it is instead of pulling it toward the
 * seed: a "moderate" band harmonised into blue stops reading as caution, which
 * is the one thing it exists to do. M3's built-in error role carries "high".
 */
const CUSTOM = [
  { name: 'moderate', value: argbFromHex('#D97706'), blend: false },
  { name: 'low', value: argbFromHex('#16A34A'), blend: false },
];

export type M3Mode = 'light' | 'dark';

export interface M3ColorRole {
  color: string;
  onColor: string;
  container: string;
  onContainer: string;
}

export interface M3Scheme {
  primary: M3ColorRole;
  secondary: M3ColorRole;
  tertiary: M3ColorRole;
  error: M3ColorRole;
  moderate: M3ColorRole;
  low: M3ColorRole;

  background: string;
  onBackground: string;

  /** Surface tones. M3 layers elevation with these, not with heavy shadows. */
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  scrim: string;
  shadow: string;
  /** Tint applied over surfaces as elevation rises. */
  surfaceTint: string;
}

const m3 = themeFromSourceColor(argbFromHex(SEED), CUSTOM);

const hex = (palette: TonalPalette, tone: number): string => hexFromArgb(palette.tone(tone));

/** Standard M3 tone assignments for a colour role. */
function role(palette: TonalPalette, mode: M3Mode): M3ColorRole {
  return mode === 'light'
    ? { color: hex(palette, 40), onColor: hex(palette, 100), container: hex(palette, 90), onContainer: hex(palette, 10) }
    : { color: hex(palette, 80), onColor: hex(palette, 20), container: hex(palette, 30), onContainer: hex(palette, 90) };
}

/** Custom colours come back from the library already resolved per mode. */
function customRole(name: string, mode: M3Mode): M3ColorRole {
  const group = m3.customColors.find((c) => c.color.name === name);
  if (!group) throw new Error(`M3: no custom colour "${name}"`);
  const scheme = mode === 'light' ? group.light : group.dark;
  return {
    color: hexFromArgb(scheme.color),
    onColor: hexFromArgb(scheme.onColor),
    container: hexFromArgb(scheme.colorContainer),
    onContainer: hexFromArgb(scheme.onColorContainer),
  };
}

export function buildScheme(mode: M3Mode): M3Scheme {
  const { primary, secondary, tertiary, error, neutral, neutralVariant } = m3.palettes;
  const light = mode === 'light';

  return {
    primary: role(primary, mode),
    secondary: role(secondary, mode),
    tertiary: role(tertiary, mode),
    error: role(error, mode),
    moderate: customRole('moderate', mode),
    low: customRole('low', mode),

    background: hex(neutral, light ? 98 : 6),
    onBackground: hex(neutral, light ? 10 : 90),

    surface: hex(neutral, light ? 98 : 6),
    onSurface: hex(neutral, light ? 10 : 90),
    surfaceVariant: hex(neutralVariant, light ? 90 : 30),
    onSurfaceVariant: hex(neutralVariant, light ? 30 : 80),

    // The five container tones are what give M3 depth without shadows.
    surfaceContainerLowest: hex(neutral, light ? 100 : 4),
    surfaceContainerLow: hex(neutral, light ? 96 : 10),
    surfaceContainer: hex(neutral, light ? 94 : 12),
    surfaceContainerHigh: hex(neutral, light ? 92 : 17),
    surfaceContainerHighest: hex(neutral, light ? 90 : 22),

    outline: hex(neutralVariant, light ? 50 : 60),
    outlineVariant: hex(neutralVariant, light ? 80 : 30),
    inverseSurface: hex(neutral, light ? 20 : 90),
    inverseOnSurface: hex(neutral, light ? 95 : 20),
    inversePrimary: hex(primary, light ? 80 : 40),
    scrim: hex(neutral, 0),
    shadow: hex(neutral, 0),
    surfaceTint: hex(primary, light ? 40 : 80),
  };
}

export const schemes: Record<M3Mode, M3Scheme> = {
  light: buildScheme('light'),
  dark: buildScheme('dark'),
};
