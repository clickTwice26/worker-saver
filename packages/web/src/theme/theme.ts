/**
 * The MUI theme, expressed in Material 3 terms.
 *
 * MUI's palette predates M3, so the two vocabularies are bridged here: M3's
 * `primaryContainer` / `onSurfaceVariant` / `surfaceContainer*` roles are added
 * to the theme and typed below, while MUI's own `primary.main` style slots are
 * filled from the same tones so stock components land on the right colours
 * without per-component overrides.
 */

import { createTheme, alpha, type Theme } from '@mui/material/styles';
import { schemes, type M3ColorRole, type M3Mode, type M3Scheme } from './m3.ts';

declare module '@mui/material/styles' {
  interface Palette {
    m3: M3Scheme;
    moderate: Palette['primary'];
    low: Palette['primary'];
  }
  interface PaletteOptions {
    m3: M3Scheme;
    moderate?: PaletteOptions['primary'];
    low?: PaletteOptions['primary'];
  }
  interface TypeBackground {
    surfaceContainer: string;
    surfaceContainerLow: string;
    surfaceContainerHigh: string;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    moderate: true;
    low: true;
  }
}
declare module '@mui/material/LinearProgress' {
  interface LinearProgressPropsColorOverrides {
    moderate: true;
    low: true;
  }
}
declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsColorOverrides {
    moderate: true;
    low: true;
  }
}

/** M3 corner radii. */
export const shape = {
  none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28,
} as const;

const toMui = (r: M3ColorRole) => ({
  main: r.color,
  contrastText: r.onColor,
  light: r.container,
  dark: r.onContainer,
});

/**
 * The M3 type scale, mapped onto MUI's variant slots.
 *
 * Display and headline sizes carry negative tracking; body and label sizes
 * carry positive tracking, which is what keeps M3 text legible at small sizes.
 */
function typography(scheme: M3Scheme) {
  const sans = '"Roboto", "Helvetica Neue", Arial, sans-serif';
  return {
    fontFamily: sans,
    h1: { fontFamily: sans, fontSize: '3.5rem', lineHeight: 64 / 57, fontWeight: 400, letterSpacing: '-0.25px' },
    h2: { fontFamily: sans, fontSize: '2.8125rem', lineHeight: 52 / 45, fontWeight: 400, letterSpacing: 0 },
    h3: { fontFamily: sans, fontSize: '2.25rem', lineHeight: 44 / 36, fontWeight: 400, letterSpacing: 0 },
    h4: { fontFamily: sans, fontSize: '2rem', lineHeight: 40 / 32, fontWeight: 400, letterSpacing: 0 },
    h5: { fontFamily: sans, fontSize: '1.75rem', lineHeight: 36 / 28, fontWeight: 400, letterSpacing: 0 },
    h6: { fontFamily: sans, fontSize: '1.375rem', lineHeight: 28 / 22, fontWeight: 500, letterSpacing: 0 },
    subtitle1: { fontFamily: sans, fontSize: '1rem', lineHeight: 24 / 16, fontWeight: 500, letterSpacing: '0.15px' },
    subtitle2: { fontFamily: sans, fontSize: '0.875rem', lineHeight: 20 / 14, fontWeight: 500, letterSpacing: '0.1px' },
    body1: { fontFamily: sans, fontSize: '1rem', lineHeight: 24 / 16, fontWeight: 400, letterSpacing: '0.5px' },
    body2: { fontFamily: sans, fontSize: '0.875rem', lineHeight: 20 / 14, fontWeight: 400, letterSpacing: '0.25px' },
    caption: { fontFamily: sans, fontSize: '0.75rem', lineHeight: 16 / 12, fontWeight: 400, letterSpacing: '0.4px' },
    button: { fontFamily: sans, fontSize: '0.875rem', lineHeight: 20 / 14, fontWeight: 500, letterSpacing: '0.1px', textTransform: 'none' as const },
    overline: { fontFamily: sans, fontSize: '0.6875rem', lineHeight: 16 / 11, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' as const },
    /** Tabular figures for everything in a data column. */
    mono: { fontFamily: '"Roboto Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' },
    scheme,
  };
}

export function buildTheme(mode: M3Mode): Theme {
  const m3 = schemes[mode];

  return createTheme({
    palette: {
      mode,
      m3,
      primary: toMui(m3.primary),
      secondary: toMui(m3.secondary),
      info: toMui(m3.tertiary),
      error: toMui(m3.error),
      warning: toMui(m3.moderate),
      success: toMui(m3.low),
      moderate: toMui(m3.moderate),
      low: toMui(m3.low),
      background: {
        default: m3.background,
        paper: m3.surfaceContainerLow,
        surfaceContainer: m3.surfaceContainer,
        surfaceContainerLow: m3.surfaceContainerLow,
        surfaceContainerHigh: m3.surfaceContainerHigh,
      },
      text: {
        primary: m3.onSurface,
        secondary: m3.onSurfaceVariant,
        disabled: alpha(m3.onSurface, 0.38),
      },
      divider: m3.outlineVariant,
      action: {
        // M3 state-layer opacities.
        hover: alpha(m3.onSurface, 0.08),
        selected: alpha(m3.primary.color, 0.12),
        focus: alpha(m3.onSurface, 0.12),
        disabled: alpha(m3.onSurface, 0.38),
        disabledBackground: alpha(m3.onSurface, 0.12),
      },
    },

    shape: { borderRadius: shape.medium },
    typography: typography(m3),

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { backgroundColor: m3.background, color: m3.onSurface },
          // Focus is restyled, never removed.
          ':focus-visible': { outline: `3px solid ${m3.primary.color}`, outlineOffset: 2 },
        },
      },

      // M3 buttons are fully rounded and flat; elevation is reserved for FABs.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: shape.extraLarge, paddingInline: 24, minHeight: 40 },
          sizeLarge: { minHeight: 48, paddingInline: 28 },
          outlined: { borderColor: m3.outline },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: shape.medium,
            backgroundColor: m3.surfaceContainerLow,
            backgroundImage: 'none',
            border: `1px solid ${m3.outlineVariant}`,
          },
        },
      },

      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: shape.small, height: 24, fontWeight: 500, letterSpacing: '0.5px' },
          label: { paddingInline: 8, fontSize: '0.6875rem' },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: m3.outlineVariant, paddingBlock: 10 },
          head: {
            backgroundColor: m3.surfaceContainer,
            color: m3.onSurfaceVariant,
            fontWeight: 500,
            fontSize: '0.6875rem',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:hover': { backgroundColor: alpha(m3.primary.color, 0.05) } },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: shape.extraSmall, backgroundColor: m3.surfaceContainerHighest },
          notchedOutline: { borderColor: m3.outline },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            // The M3 navigation-drawer pill.
            borderRadius: shape.extraLarge,
            minHeight: 48,
            paddingInline: 16,
            '&.Mui-selected': {
              backgroundColor: m3.secondary.container,
              color: m3.secondary.onContainer,
              '& .MuiListItemIcon-root': { color: m3.secondary.onContainer },
              '&:hover': { backgroundColor: m3.secondary.container },
            },
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 36, color: m3.onSurfaceVariant } } },

      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: {
            backgroundColor: m3.surface,
            color: m3.onSurface,
            borderBottom: `1px solid ${m3.outlineVariant}`,
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: m3.inverseSurface,
            color: m3.inverseOnSurface,
            borderRadius: shape.extraSmall,
            fontSize: '0.75rem',
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: shape.extraSmall, height: 8, backgroundColor: m3.surfaceContainerHighest },
          bar: { borderRadius: shape.extraSmall },
        },
      },
    },
  });
}
