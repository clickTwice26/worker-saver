import {
  Box, Card, Chip, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import type { Finding, ScheduleMonth } from '@ale/shared';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t, formatNumber, formatDate, formatMonth, formatCurrency } from '../copy/index.ts';
import {
  BandChip, ConfidenceChip, EmptyState, ErrorState, LoadingState,
  SectionHeading, SeverityRail, StatTile, StatusChip,
} from '../components/Primitives.tsx';

/**
 * The plan.
 *
 * Ordered by how soon training must begin rather than by risk score: the
 * question a factory is holding is "what do I start first", and a role with a
 * lower score but a closer deadline outranks a higher one with slack.
 */
export function PlanPage() {
  const { factory, refreshKey } = useApp();
  const plan = useAsync(() => api.getPlan(factory.id), [factory.id, refreshKey]);

  if (plan.loading) return <LoadingState />;
  if (plan.error) return <ErrorState message={plan.error} onRetry={plan.reload} />;
  if (!plan.data) return <ErrorState message="No plan returned." />;

  const { findings, schedule, totals, run } = plan.data;

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('planTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {factory.name} · {factory.productMix}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatTile label={t('workforceModelled')} value={formatNumber(totals.workforceModelled)} note={`${formatNumber(totals.rolesTracked)} ${t('rolesTracked')}`} />
        <StatTile label={t('weightedRisk')} value={`${formatNumber(totals.weightedRiskScore)}%`} note={t('estimated')} />
        <StatTile label={t('workersAffected')} value={formatNumber(totals.workersAffected)} note={`${formatNumber(totals.totalSeats)} ${t('seats')}`} />
        <StatTile label={t('trainingCost')} value={formatCurrency(totals.totalCostBdt)} note={`${formatNumber(findings.length)} × ${t('training')}`} />
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

      <Box sx={{ mb: 3 }}>
        <SectionHeading title={t('findingsTitle')} />
        {findings.length === 0
          ? <Card><EmptyState message={t('noFindings')} /></Card>
          : <Card><FindingsTable findings={findings} /></Card>}
      </Box>

      {schedule.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <SectionHeading title={t('calendarTitle')} />
          <Card><Calendar months={schedule} /></Card>
        </Box>
      ) : null}

      {/* Run provenance: which rules produced these numbers. */}
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
        run #{run.id} · as of {formatDate(run.asOfDate)} · engine {run.engineVersion} · {run.rulesVersion}
      </Typography>
    </>
  );
}

function FindingsTable({ findings }: { findings: Finding[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 210 }}>{t('role')}</TableCell>
            <TableCell align="right">{t('workers')}</TableCell>
            <TableCell>{t('arrives')}</TableCell>
            <TableCell>{t('startBy')}</TableCell>
            <TableCell sx={{ minWidth: 190 }}>{t('training')}</TableCell>
            <TableCell align="right">{t('cost')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {findings.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  <SeverityRail band={f.riskBand} />{f.roleLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: '52ch', mt: 0.5 }}>
                  <strong>{t('why')}:</strong> {f.rationale}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'Roboto Mono, monospace', fontSize: 10.5 }}>
                  {t('source')}: {f.sourceRef}
                </Typography>
                {/* Which engine produced the number, stated on the number. */}
                <Chip
                  size="small"
                  variant="outlined"
                  color={f.scoreSource === 'model' ? 'primary' : undefined}
                  label={f.scoreSource === 'model' ? t('scoredByModel') : t('scoredByRules')}
                  sx={{ mt: 0.5 }}
                />
              </TableCell>
              <TableCell align="right">
                {formatNumber(f.workersAffected)}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  / {formatNumber(f.headcount)}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(f.arrivalDate)}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.machineName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {formatNumber(f.monthsUntilImpact)} {t('month')}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(f.startByDate)}</Typography>
                <Box sx={{ mt: 0.5 }}><StatusChip status={f.scheduleStatus} /></Box>
              </TableCell>
              <TableCell>
                {f.trainingProgramName}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {formatNumber(f.cohortsRequired)} {t('cohorts')} · {formatNumber(f.trainingDurationWeeks)} {t('weeks')} · {formatNumber(f.trainingSeatsPerMonth)} {t('seats')}/{t('month')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.trainingProvider}</Typography>
              </TableCell>
              <TableCell align="right">
                {formatCurrency(f.estimatedCostBdt)}
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', mt: 0.5 }}>
                  <BandChip band={f.riskBand} />
                  <ConfidenceChip confidence={f.confidence} />
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** The training calendar, one row per month. */
function Calendar({ months }: { months: ScheduleMonth[] }) {
  return (
    <Box>
      {months.map((month, index) => (
        <Box
          key={month.month}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '170px 1fr 140px' },
            gap: 2, px: 2.5, py: 1.75,
            borderBottom: index === months.length - 1 ? 0 : 1,
            borderColor: 'divider',
            bgcolor: index % 2 === 1 ? 'background.surfaceContainer' : undefined,
          }}
        >
          <Box>
            <Typography variant="subtitle2">{formatMonth(month.month)}</Typography>
            <Typography variant="overline" color="text.secondary">
              {formatNumber(month.seatsThisMonth)} {t('seats')}
            </Typography>
          </Box>
          <Stack spacing={1}>
            {month.entries.map((entry, i) => (
              <Box key={`${entry.roleSlug}-${entry.cohortIndex}-${i}`} sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Chip size="small" color="primary" variant="outlined" label={formatNumber(entry.seats)} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.roleLabel}</Typography>
                <Typography variant="caption" color="text.secondary">{entry.trainingProgramName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('cohorts')} {formatNumber(entry.cohortIndex)}/{formatNumber(entry.cohortsTotal)} · {entry.machineName} {formatDate(entry.arrivalDate)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: { md: 'right' }, fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(month.costThisMonthBdt)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
