import {
  Alert, Box, Card, Chip, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import type { MachineType } from '@ale/shared';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { t, formatNumber, formatCurrency } from '../copy/index.ts';
import { ConfidenceChip, ErrorState, LoadingState } from '../components/Primitives.tsx';

/**
 * The machine catalogue.
 *
 * The reference data behind every displacement figure. It is a page rather than
 * a hidden table because the whole claim of the product is that it computes what
 * a machine does to a roster — and a computed number nobody can inspect is worth
 * no more than the guess it replaced.
 */
export function MachinesPage() {
  const machines = useAsync(() => api.listMachineTypes(), []);

  if (machines.loading) return <LoadingState />;
  if (machines.error) return <ErrorState message={machines.error} onRetry={machines.reload} />;

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('machinesTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '72ch' }}>
        {t('machinesIntro')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(machines.data ?? []).map((machine) => <MachineCard key={machine.slug} machine={machine} />)}
      </Box>
    </>
  );
}

function MachineCard({ machine }: { machine: MachineType }) {
  const netPerUnit = machine.impact.reduce((sum, i) => sum + i.createdPerUnit - i.displacedPerUnit, 0);

  return (
    <Card>
      <Box sx={{ px: 2.5, py: 1.75, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1" component="h2">{machine.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {machine.category} · {machine.automationLevel.replace('_', ' ')} · {t('installLead')}{' '}
            {formatNumber(machine.installLeadWeeks)} {t('weeks')}
          </Typography>
        </Box>
        <ConfidenceChip confidence={machine.confidence} />
      </Box>
      <Divider />

      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
          <Spec label={t('capitalCost')} value={formatCurrency(machine.capitalCostBdt)} />
          <Spec label={t('replaces')} value={`${formatNumber(machine.throughputWorkersEquivalent)} workers`} />
          <Spec label={t('operatorsNeeded')} value={formatNumber(machine.operatorsRequired)} />
          <Spec
            label={t('netChange')}
            value={`${netPerUnit > 0 ? '+' : ''}${formatNumber(Math.round(netPerUnit))} ${t('perUnit')}`}
            tone={netPerUnit < 0 ? 'error' : undefined}
          />
        </Box>

        {machine.healthSafetyNote ? (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2, borderRadius: 3 }}>
            <strong>{t('healthSafety')}.</strong> {machine.healthSafetyNote}
          </Alert>
        ) : null}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: '78ch' }}>
          {machine.notes}
        </Typography>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 170 }}>{t('role')}</TableCell>
                <TableCell align="right">{t('displaces')}</TableCell>
                <TableCell align="right">{t('creates')}</TableCell>
                <TableCell>{t('why')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {machine.impact.map((impact) => (
                <TableRow key={impact.roleSlug}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{impact.roleLabel}</Typography></TableCell>
                  <TableCell align="right">{formatNumber(impact.displacedPerUnit)}</TableCell>
                  <TableCell align="right">{formatNumber(impact.createdPerUnit)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '62ch' }}>
                      {impact.rationale}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {machine.operations.length > 0 ? (
          <Box sx={{ mt: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="overline" color="text.secondary">{t('operationsCovered')}</Typography>
            {machine.operations.map((o) => (
              <Chip key={o.operationCode} size="small" variant="outlined" label={`${o.operationName} · ${o.coverage}%`} />
            ))}
          </Box>
        ) : null}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontFamily: 'Roboto Mono, monospace' }}>
          {t('source')}: {machine.sourceRef}
        </Typography>
      </Box>
    </Card>
  );
}

function Spec({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.surfaceContainer' }}>
      <Typography variant="overline" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, color: tone === 'error' ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}
