import { useState } from 'react';
import { NavLink, Link as RouterLink, Outlet, useOutletContext, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Button, Chip, Divider, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, MenuItem, TextField, Toolbar,
  Typography, useMediaQuery, useTheme,
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import ChecklistIcon from '@mui/icons-material/Checklist';
import TuneIcon from '@mui/icons-material/Tune';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import type { Factory } from '@ale/shared';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { t, formatNumber } from '../copy/index.ts';
import { ErrorState, LoadingState } from '../components/Primitives.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { BrandMark } from '../components/BrandMark.tsx';
import { useFactory } from './FactoryContext.tsx';
import { NoFactories } from './NoFactories.tsx';

const DRAWER_WIDTH = 248;

export interface AppContext {
  factory: Factory;
  refreshKey: number;
  bumpRefresh: () => void;
}

export function useApp(): AppContext {
  return useOutletContext<AppContext>();
}

const NAV = [
  { to: '/app/overview', key: 'navOverview', Icon: InsightsIcon },
  { to: '/app/plan', key: 'navPlan', Icon: ChecklistIcon },
  { to: '/app/setup', key: 'navSetup', Icon: TuneIcon },
  { to: '/app/import', key: 'navImport', Icon: UploadFileIcon },
  { to: '/app/model', key: 'navModel', Icon: ModelTrainingIcon },
  { to: '/app/machines', key: 'navMachines', Icon: PrecisionManufacturingIcon },
  { to: '/app/knowledge', key: 'navKnowledge', Icon: MenuBookIcon },
  { to: '/app/report', key: 'navReport', Icon: VerifiedUserIcon },
] as const;

/**
 * The application shell: an M3 navigation drawer beside a top app bar.
 *
 * The drawer is permanent from the medium breakpoint up and modal below it,
 * which is the standard M3 adaptive pattern — the same destinations either way,
 * so the navigation never changes shape between devices.
 */
export function AppLayout() {
  const theme = useTheme();
  const permanent = useMediaQuery(theme.breakpoints.up('md'));
  const { factoryId, setFactoryId, refreshKey, bumpRefresh } = useFactory();
  const [running, setRunning] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const factories = useAsync(() => api.listFactories(), [refreshKey]);
  const list = factories.data ?? [];
  const factory = list.find((f) => f.id === factoryId) ?? list[0] ?? null;

  // Nothing ships pre-loaded, so a fresh install has no factory to show.
  if (!factories.loading && !factories.error && list.length === 0) {
    return <NoFactories onCreated={(id) => { setFactoryId(id); bumpRefresh(); }} />;
  }

  const runAnalysis = async () => {
    if (!factory) return;
    setRunning(true);
    try {
      await api.runAnalysis(factory.id);
      bumpRefresh();
    } finally {
      setRunning(false);
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: 1.5, py: 2 }}>
      <Box
        component={RouterLink}
        to="/"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1, textDecoration: 'none', minHeight: 48 }}
      >
        <BrandMark size={32} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {t('appName')}
        </Typography>
      </Box>

      <List sx={{ mt: 2, flexGrow: 1 }} aria-label="Sections">
        {NAV.map(({ to, key, Icon }) => (
          <ListItem key={to} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={NavLink}
              to={to}
              selected={location.pathname === to}
              onClick={() => setDrawerOpen(false)}
            >
              {/* Icons sit beside visible labels, so they are decorative. */}
              <ListItemIcon><Icon fontSize="small" aria-hidden="true" /></ListItemIcon>
              <ListItemText
                primary={t(key)}
                slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 500 } } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mb: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
        <Button
          component={RouterLink}
          to="/"
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary' }}
        >
          {t('backToSite')}
        </Button>
        <ThemeToggle />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={permanent ? 'permanent' : 'temporary'}
          open={permanent || drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH, boxSizing: 'border-box',
              bgcolor: 'background.surfaceContainerLow',
              borderRight: 1, borderColor: 'divider', borderImage: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky">
          <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
            {!permanent ? (
              <IconButton edge="start" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
                <MenuIcon />
              </IconButton>
            ) : null}

            <TextField
              select
              size="small"
              label={t('factory')}
              value={factory?.id ?? ''}
              onChange={(e) => setFactoryId(Number(e.target.value))}
              sx={{ minWidth: 260 }}
            >
              {list.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name} · {formatNumber(f.workforceSize)}
                </MenuItem>
              ))}
            </TextField>

            {factory?.isDemo ? (
              <Chip size="small" color="moderate" variant="filled" label={t('demoBadge')} />
            ) : null}

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="contained"
              disabled={!factory || running}
              onClick={() => void runAnalysis()}
              startIcon={
                <RefreshIcon
                  sx={running ? {
                    animation: 'ale-spin 900ms linear infinite',
                    '@keyframes ale-spin': { to: { transform: 'rotate(360deg)' } },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  } : undefined}
                />
              }
            >
              {running ? t('running') : t('runAnalysis')}
            </Button>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, width: '100%' }}>
          {factories.loading ? <LoadingState /> : null}
          {factories.error ? <ErrorState message={factories.error} onRetry={factories.reload} /> : null}
          {factory ? <Outlet context={{ factory, refreshKey, bumpRefresh } satisfies AppContext} /> : null}
        </Box>
      </Box>
    </Box>
  );
}
