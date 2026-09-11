import { IconButton, Tooltip } from '@mui/material';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode } from '../theme/ThemeModeProvider.tsx';

const LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' } as const;

/** Cycles auto → light → dark. */
export function ThemeToggle() {
  const { setting, cycle } = useThemeMode();

  return (
    <Tooltip title={`Theme: ${LABEL[setting]}`}>
      <IconButton
        onClick={cycle}
        aria-label={`Colour theme: ${LABEL[setting]}. Activate to change.`}
        sx={{ color: 'text.secondary' }}
      >
        {setting === 'light' ? <LightModeIcon fontSize="small" />
          : setting === 'dark' ? <DarkModeIcon fontSize="small" />
          : <BrightnessAutoIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
