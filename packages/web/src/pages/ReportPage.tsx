import {
  Alert, Box, Button, Card, Divider, Table, TableBody, TableCell, TableContainer,
  TableFooter, TableHead, TableRow, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t, formatNumber, formatDate, formatCurrency } from '../copy/index.ts';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '../components/Primitives.tsx';

/**
 * The buyer-facing transition report.
 *
 * The commercial artifact: dated evidence that the factory knew a machine was
 * coming and trained ahead of it. Deliberately a list of commitments, not a
 * ranked risk register — see docs/ethics.md. Printing to PDF is the export.
 */
export function ReportPage() {
  const { factory, refreshKey } = useApp();
  const report = useAsync(() => api.getReport(factory.id), [factory.id, refreshKey]);

  if (report.loading) return <LoadingState />;
  if (report.error) return <ErrorState message={report.error} onRetry={report.reload} />;
  if (!report.data) return <ErrorState message="No report returned." />;

  const { plan, commitments, disclosure, generatedAt } = report.data;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ maxWidth: '62ch' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('reportTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('reportIntro')}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ '@media print': { display: 'none' } }}
        >
          {t('print')}
        </Button>
      </Box>

      <Alert severity="info" variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
        <strong>{plan.factory.name}</strong> · {plan.factory.location} ·{' '}
        {formatNumber(plan.totals.workforceModelled)} {t('workers')} ·{' '}
        {formatNumber(plan.totals.rolesTracked)} {t('rolesTracked')}
      </Alert>

      <SectionHeading title={t('commitments')} />
      <Card sx={{ mb: 3 }}>
        {commitments.length === 0 ? (
          <EmptyState message={t('noFindings')} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 190 }}>{t('role')}</TableCell>
                  <TableCell align="right">{t('workers')}</TableCell>
                  <TableCell sx={{ minWidth: 190 }}>{t('training')}</TableCell>
                  <TableCell>{t('startBy')}</TableCell>
                  <TableCell>{t('completesBy')}</TableCell>
                  <TableCell align="right">{t('cost')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commitments.map((c, index) => (
                  <TableRow key={`${c.roleLabel}-${c.startByDate}-${index}`}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{c.roleLabel}</Typography></TableCell>
                    <TableCell align="right">{formatNumber(c.workersAffected)}</TableCell>
                    <TableCell>{c.trainingProgramName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.startByDate)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.completesByDate)}</TableCell>
                    <TableCell align="right">{formatCurrency(c.costBdt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell><Typography variant="subtitle2">{t('total')}</Typography></TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">
                      {formatNumber(commitments.reduce((s, c) => s + c.workersAffected, 0))}
                    </Typography>
                  </TableCell>
                  <TableCell colSpan={3} />
                  <TableCell align="right">
                    <Typography variant="subtitle2">{formatCurrency(plan.totals.totalCostBdt)}</Typography>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        )}
      </Card>

      <SectionHeading title={t('disclosure')} />
      <Card>
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '74ch' }}>{disclosure}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
            {t('generatedAt')} {new Date(generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC ·{' '}
            run #{plan.run.id} · engine {plan.run.engineVersion} · {plan.run.rulesVersion}
          </Typography>
        </Box>
      </Card>
    </>
  );
}
