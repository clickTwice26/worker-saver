import type { ReactNode } from 'react';
import {
  Box, Card, CardContent, Chip, CircularProgress, Typography, Alert, Button,
} from '@mui/material';
import type { Confidence, RiskBand, ScheduleStatus } from '@ale/shared';
import { t } from '../copy/index.ts';

/** Maps a risk band onto its M3 colour role. */
const BAND_ROLE = { high: 'error', moderate: 'moderate', low: 'low' } as const;
const BAND_LABEL = { high: t('high'), moderate: t('moderate'), low: t('low') } as const;

/**
 * Risk band as an M3 filled chip.
 *
 * The band name is always spelled out, so the meaning never rests on the colour
 * alone — which matters most on the one screen where colour carries the point.
 */
export function BandChip({ band }: { band: RiskBand }) {
  return <Chip size="small" label={BAND_LABEL[band]} color={BAND_ROLE[band]} variant="filled" />;
}

const STATUS = {
  on_track: { label: t('onTrack'), color: 'low' },
  starts_soon: { label: t('startsSoon'), color: 'moderate' },
  overdue: { label: t('overdue'), color: 'error' },
} as const;

export function StatusChip({ status }: { status: ScheduleStatus }) {
  const { label, color } = STATUS[status];
  return <Chip size="small" label={label} color={color} variant="filled" />;
}

/**
 * Whether a figure rests on a source or an estimate.
 *
 * Shown beside the number rather than in a footnote: v1's knowledge base is
 * seeded from demo data, and the product says so where the value appears.
 */
export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={confidence === 'sourced' ? t('sourced') : t('estimated')}
      sx={{ color: 'text.secondary', borderColor: 'divider' }}
    />
  );
}

/** A 3px severity rail. Pairs with a chip or a label, never used alone. */
export function SeverityRail({ band }: { band: RiskBand }) {
  return (
    <Box
      aria-hidden="true"
      component="span"
      sx={{
        display: 'inline-block', width: 3, height: '1.05em', mr: 1,
        verticalAlign: '-0.18em', borderRadius: 1,
        bgcolor: band === 'high' ? 'error.main' : band === 'moderate' ? 'moderate.main' : 'low.main',
      }}
    />
  );
}

/** A headline figure. M3 surfaces carry these, not shadows. */
export function StatTile({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: 'error';
}) {
  return (
    <Card>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" component="div">{label}</Typography>
        <Typography
          variant="h4"
          component="div"
          sx={{ my: 0.5, fontWeight: 500, color: tone === 'error' ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
        {note ? <Typography variant="body2" color="text.secondary">{note}</Typography> : null}
      </CardContent>
    </Card>
  );
}

/** A titled surface. `action` sits opposite the title. */
export function Panel({ title, hint, action, children, disablePadding }: {
  title: string; hint?: string; action?: ReactNode; children: ReactNode; disablePadding?: boolean;
}) {
  return (
    <Card>
      <Box
        sx={{
          px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="subtitle1" component="h3">{title}</Typography>
          {hint ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : null}
        </Box>
        {action}
      </Box>
      <Box sx={disablePadding ? undefined : { p: 2.5 }}>{children}</Box>
    </Card>
  );
}

export function SectionHeading({ title, hint, action }: {
  title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
      <Box>
        <Typography variant="h6" component="h2">{title}</Typography>
        {hint ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : null}
      </Box>
      {action}
    </Box>
  );
}

export function LoadingState() {
  return (
    <Box role="status" sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">{t('loading')}</Typography>
    </Box>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      sx={{ borderRadius: 3 }}
      action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>{t('retry')}</Button> : undefined}
    >
      <Typography variant="subtitle2">{t('errorTitle')}</Typography>
      <Typography variant="body2">{message}</Typography>
    </Alert>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
      {message}
    </Typography>
  );
}
