import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/en-gb';
import { buildTheme } from './theme.ts';
import type { M3Mode } from './m3.ts';

export type ThemeSetting = 'system' | 'light' | 'dark';

interface ThemeModeValue {
  setting: ThemeSetting;
  mode: M3Mode;
  cycle: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

const STORAGE_KEY = 'ale-theme';
const ORDER: ThemeSetting[] = ['system', 'light', 'dark'];

function readStored(): ThemeSetting {
  // Storage throws outright in some embedded contexts, so never assume it works.
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* fall through to the system default */
  }
  return 'system';
}

/**
 * Light and dark M3 schemes, with `system` deferring to the OS.
 *
 * Both themes are built from the same tonal palettes, so the two are guaranteed
 * to agree on hue and on every `on-` contrast pair rather than being two
 * palettes maintained side by side.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(readStored);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const mode: M3Mode = setting === 'system' ? (prefersDark ? 'dark' : 'light') : setting;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, setting);
    } catch {
      /* the choice still applies for this session */
    }
  }, [setting]);

  const cycle = useCallback(
    () => setSetting((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!),
    [],
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const value = useMemo(() => ({ setting, mode, cycle }), [setting, mode, cycle]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* en-gb so the pickers read DD/MM/YYYY, matching how every other date
            in the product is formatted. */}
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode must be used inside <ThemeModeProvider>');
  return value;
}
