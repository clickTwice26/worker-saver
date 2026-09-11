import {
  Box, Card, Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography, LinearProgress, Stack,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTheme } from '@mui/material/styles';
import type { RiskRule, TransitionPlan } from '@ale/shared';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t, formatNumber, formatDate, formatCurrency } from '../copy/index.ts';
import {
  BandChip, EmptyState, ErrorState, LoadingState, Panel, StatTile, StatusChip,
} from '../components/Primitives.tsx';

/**
 * The dashboard: summary before detail.
 *
 * Four headline figures, then where the exposure sits and when the training
 * load lands, then the purchase case, then the arrivals themselves.
 */
export function OverviewPage() {
  const { factory, refreshKey } = useApp();
  const plan = useAsync(() => api.getPlan(factory.id), [factory.id, refreshKey]);
  const rules = useAsync(() => api.listRiskRules(), []);

  if (plan.loading || rules.loading) return <LoadingState />;
  if (plan.error) return <ErrorState message={plan.error} onRetry={plan.reload} />;
  if (!plan.data) return <ErrorState message="No plan returned." />;

  const { totals } = plan.data;

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{factory.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {factory.location} · {factory.productMix} · {t('overviewIntro')}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatTile
          label={t('workforceModelled')}
          value={formatNumber(totals.workforceModelled)}
          note={`${formatNumber(totals.rolesTracked)} ${t('rolesTracked')}`}
        />
        <StatTile label={t('weightedRisk')} value={`${formatNumber(totals.weightedRiskScore)}%`} note={t('estimated')} />
        <StatTile
          label={t('workersAffected')}
          value={formatNumber(totals.workersAffected)}
          note={`${formatNumber(totals.totalSeats)} ${t('seats')}`}
        />
        <StatTile
          label={t('netEffectTitle')}
          value={`${totals.netWorkforceChange > 0 ? '+' : ''}${formatNumber(totals.netWorkforceChange)}`}
          note={`${formatNumber(totals.workersCreated)} ${t('workersCreatedLabel').toLowerCase()}`}
          tone={totals.netWorkforceChange < 0 ? 'error' : undefined}
        />
      </Box>

      {totals.overdueCount > 0 ? (
        <Card sx={{ mb: 3, borderColor: 'error.main', bgcolor: 'error.light' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'error.dark' }}>
              {formatNumber(totals.overdueCount)} {t('overdueWarning')}.
            </Typography>
          </Box>
        </Card>
      ) : null}

      <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Panel title={t('riskByRoleTitle')} hint={t('riskByRoleHint')}>
          <RiskByRole plan={plan.data} rules={rules.data ?? []} />
        </Panel>
        <Panel title={t('trainingLoadTitle')} hint={t('trainingLoadHint')}>
          <TrainingLoad plan={plan.data} />
        </Panel>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Panel title={t('economicsTitle')} hint={t('economicsHint')} disablePadding>
          <Economics plan={plan.data} />
        </Panel>
      </Box>

      <Panel title={t('upcomingTitle')} disablePadding>
        <Upcoming plan={plan.data} />
      </Panel>
    </>
  );
}

/**
 * Risk across the roster, ordered by score.
 *
 * Bar length carries the score and the figures beside it repeat it as text, so
 * nothing here depends on colour or on sight. Built with LinearProgress rather
 * than a chart because each row is one value against a fixed 0-100 scale.
 */
function RiskByRole({ plan, rules }: { plan: TransitionPlan; rules: RiskRule[] }) {
  const best = new Map<number, RiskRule>();
  for (const rule of rules) {
    const held = best.get(rule.roleId);
    if (!held || rule.baseScore > held.baseScore) best.set(rule.roleId, rule);
  }

  const rows = plan.roster
    .flatMap((h) => {
      const rule = best.get(h.roleId);
      return rule ? [{ headcount: h, rule }] : [];
    })
    .sort((a, b) => b.rule.baseScore - a.rule.baseScore)
    .slice(0, 10);

  if (rows.length === 0) return <EmptyState message="—" />;

  return (
    <Stack spacing={1.25}>
      {rows.map(({ headcount, rule }) => (
        <Box key={headcount.roleId} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px 1fr 96px' }, gap: 1.5, alignItems: 'center' }}>
          <Typography variant="body2" noWrap title={headcount.roleLabel}>{headcount.roleLabel}</Typography>
          <LinearProgress
            variant="determinate"
            value={rule.baseScore}
            color={rule.band === 'high' ? 'error' : rule.band === 'moderate' ? 'moderate' : 'low'}
            aria-label={`${headcount.roleLabel}: risk ${rule.baseScore} of 100`}
          />
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: { sm: 'right' }, fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(rule.baseScore)} · {formatNumber(headcount.headcount)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

/** Seats required per month. Months already past are drawn in the error role. */
function TrainingLoad({ plan }: { plan: TransitionPlan }) {
  const theme = useTheme();
  const months = plan.schedule.slice(0, 14);
  if (months.length === 0) return <EmptyState message="—" />;

  const currentMonth = plan.run.asOfDate.slice(0, 7);
  const labels = months.map((m) => m.month.slice(2).replace('-', '/'));

  return (
    <>
      {/* The values as text, so the chart is not the only way to read them. */}
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {months.map((m) => `${m.month}: ${m.seatsThisMonth} seats.`).join(' ')}
      </Box>
      <BarChart
        height={250}
        margin={{ top: 8, right: 8, bottom: 28, left: 40 }}
        xAxis={[{ scaleType: 'band', data: labels }]}
        // Two stacked series rather than one series with per-bar colour: the
        // legend then names the distinction in words, so a month whose window
        // has passed is not identified by hue alone.
        series={[
          {
            data: months.map((m) => (m.month < currentMonth ? m.seatsThisMonth : 0)),
            label: t('seatsPast'),
            stack: 'seats',
            color: theme.palette.error.main,
          },
          {
            data: months.map((m) => (m.month < currentMonth ? 0 : m.seatsThisMonth)),
            label: t('seatsUpcoming'),
            stack: 'seats',
            color: theme.palette.primary.main,
          },
        ]}
        borderRadius={4}
        slotProps={{ legend: { sx: { fontSize: 11 } } }}
        sx={{ '& .MuiChartsAxis-tickLabel': { fontSize: 10 } }}
      />
    </>
  );
}

/**
 * The purchase case.
 *
 * Sorted by payback: a short payback beside a large net displacement means the
 * purchase is very likely to proceed, so the training window is the only
 * variable actually in play.
 */
function Economics({ plan }: { plan: TransitionPlan }) {
  const ordered = [...plan.findings].sort(
    (a, b) => (a.paybackMonths ?? Infinity) - (b.paybackMonths ?? Infinity),
  );
  if (ordered.length === 0) return <EmptyState message={t('noPlans')} />;

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 190 }}>{t('machine')}</TableCell>
            <TableCell align="right">{t('displaces')}</TableCell>
            <TableCell align="right">{t('creates')}</TableCell>
            <TableCell align="right">{t('netChange')}</TableCell>
            <TableCell align="right">{t('capitalOutlay')}</TableCell>
            <TableCell align="right">{t('monthlySaving')}</TableCell>
            <TableCell align="right">{t('payback')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ordered.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.machineName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.roleLabel}</Typography>
                {f.healthSafetyNote ? (
                  <Chip size="small" color="error" label={t('healthSafety')} sx={{ mt: 0.5 }} />
                ) : null}
              </TableCell>
              <TableCell align="right">{formatNumber(f.workersAffected)}</TableCell>
              <TableCell align="right">{formatNumber(f.workersCreated)}</TableCell>
              <TableCell align="right" sx={{ color: f.netWorkforceChange < 0 ? 'error.main' : undefined, fontWeight: 500 }}>
                {f.netWorkforceChange > 0 ? '+' : ''}{formatNumber(f.netWorkforceChange)}
              </TableCell>
              <TableCell align="right">{formatCurrency(f.capitalCostBdt)}</TableCell>
              <TableCell align="right">{formatCurrency(f.monthlyLabourSavingBdt)}</TableCell>
              <TableCell align="right">
                {f.paybackMonths === null ? '—' : `${formatNumber(f.paybackMonths)} ${t('months')}`}
                {f.retrainingCostRatio !== null ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {t('retrainingRatio')}: {(f.retrainingCostRatio * 100).toFixed(1)}%
                  </Typography>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** The arrivals themselves, soonest first. */
function Upcoming({ plan }: { plan: TransitionPlan }) {
  if (plan.findings.length === 0) return <EmptyState message={t('noPlans')} />;

  const byArrival = [...plan.findings].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));

  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {byArrival.map((f) => (
            <TableRow key={f.id}>
              <TableCell sx={{ width: 120, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" color="text.secondary">{formatDate(f.arrivalDate)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.machineName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {f.roleLabel} · {formatNumber(f.workersAffected)} {t('workers')} · {t('startBy')} {formatDate(f.startByDate)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end' }}>
                  <BandChip band={f.riskBand} />
                  <StatusChip status={f.scheduleStatus} />
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
