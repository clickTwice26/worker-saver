import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, LinearProgress, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import type { DatasetImportResult, ImportKind, ImportResult } from '@ale/shared';
import { api, ApiRequestError } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t } from '../copy/index.ts';
import { ErrorState, LoadingState, Panel, SectionHeading } from '../components/Primitives.tsx';
import { DemoFill, DEV_TOOLS, pickOne, randomInt, randomIsoDate } from '../components/DemoFill.tsx';

const KINDS: Array<{ value: ImportKind; label: string; help: string }> = [
  { value: 'roster', label: 'Roster — headcounts by role', help: 'How many workers you have in each role. A handful of rows.' },
  { value: 'machinery', label: 'Machine roadmap', help: 'What is arriving and when. Displacement is derived from the catalogue.' },
  { value: 'workers', label: 'Worker records (pseudonymous)', help: 'Optional. HR identifiers only — files containing names are rejected.' },
  { value: 'outcomes', label: 'Recorded outcomes', help: 'What actually happened after past arrivals. This is what trains the model.' },
];

/**
 * CSV import.
 *
 * Files are read in the browser and posted as text. Every row is validated
 * server-side and failures come back with a line number, so a 3,000-row export
 * with a few bad rows is corrected rather than rejected wholesale.
 */
export function ImportPage() {
  const { factory, bumpRefresh } = useApp();
  const [kind, setKind] = useState<ImportKind>('roster');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [datasetBusy, setDatasetBusy] = useState<string | null>(null);
  const [datasetResult, setDatasetResult] = useState<DatasetImportResult | null>(null);

  const columns = useAsync(() => api.importColumns(), []);
  const datasets = useAsync(() => api.listDatasets(), []);
  const history = useAsync(
    () => api.listImports(factory.id),
    [factory.id, result?.batchId ?? 0, datasetResult?.dataset ?? ''],
  );

  /**
   * Import a dataset the server already holds.
   *
   * A million-row outcomes file is ~140MB; reading it where it lives avoids
   * loading it into the browser and posting it back as a JSON string.
   */
  const importDataset = async (name: string) => {
    setDatasetBusy(name);
    setError(null);
    setDatasetResult(null);
    setResult(null);
    try {
      const imported = await api.importDataset(factory.id, name);
      setDatasetResult(imported);
      if (imported.totalAccepted > 0) bumpRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setDatasetBusy(null);
    }
  };

  /**
   * Build a small CSV of the selected kind and push it through the real import
   * endpoint — the same validation path a user's file takes, so the shortcut
   * exercises the code rather than going around it.
   */
  const fillDemo = async () => {
    const roles = ['Sewing Machine Operators', 'Cutting Machine Operators', 'Packing Staff',
      'Finishing & Ironing Staff', 'Helpers & Line Feeders'];
    const grades = ['entry', 'semi_skilled', 'skilled'];
    const machineSlugs = ['automated-sewing-unit', 'automated-laser-cutter',
      'automatic-spreading-machine', 'tunnel-finisher', 'automated-packing-line'];
    let csv = '';

    if (kind === 'roster') {
      csv = ['role,workers', ...roles.map((r) => `"${r}",${randomInt(60, 1800)}`)].join('\n');
    } else if (kind === 'machinery') {
      csv = ['machine_type,arrival_date,units', ...Array.from({ length: 4 }, () =>
        `${pickOne(machineSlugs)},${randomIsoDate(2, 20)},${randomInt(1, 6)}`)].join('\n');
    } else if (kind === 'workers') {
      csv = ['worker_ref,role,tenure_months,operations_known,skill_grade',
        ...Array.from({ length: 60 }, (_, i) =>
          `DEV-${1000 + i},"${pickOne(roles)}",${randomInt(1, 200)},${randomInt(1, 6)},${pickOne(grades)}`),
      ].join('\n');
    } else {
      // Enough rows, and enough of each result, to clear the training floor.
      csv = ['worker_ref,role,arrival_date,outcome,tenure_months,operations_known,skill_grade,retraining_result',
        ...Array.from({ length: 120 }, (_, i) => {
          const displaced = Math.random() < 0.35;
          const tenure = displaced ? randomInt(1, 20) : randomInt(40, 200);
          const ops = displaced ? randomInt(1, 2) : randomInt(3, 6);
          return `DEV-${2000 + i},"${pickOne(roles)}",${randomIsoDate(-30, -6)},` +
            `${displaced ? 'displaced' : 'retained'},${tenure},${ops},` +
            `${displaced ? 'entry' : 'skilled'},${Math.random() < 0.5 ? 'passed' : 'failed'}`;
        }),
      ].join('\n');
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const imported = await api.importCsv(factory.id, kind, csv, `dev-${kind}.csv`);
      setResult(imported);
      if (imported.rowsAccepted > 0) bumpRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const csv = await file.text();
      const imported = await api.importCsv(factory.id, kind, csv, file.name);
      setResult(imported);
      if (imported.rowsAccepted > 0) bumpRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  if (columns.loading) return <LoadingState />;

  const spec = columns.data?.[kind];
  const selected = KINDS.find((k) => k.value === kind)!;

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('importTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '72ch' }}>
        {t('importIntro')}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Panel
          title={t('importUpload')}
          hint={selected.help}
          action={DEV_TOOLS
            ? <DemoFill onFill={() => void fillDemo()} label="Generate & import" />
            : undefined}
        >
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, alignItems: 'start' }}>
            <TextField
              select
              size="small"
              label={t('importKind')}
              value={kind}
              onChange={(e) => { setKind(e.target.value as ImportKind); setResult(null); }}
            >
              {KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
            </TextField>

            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? t('importing') : t('importChoose')}
            </Button>
          </Box>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />

          {busy ? <LinearProgress sx={{ mt: 2 }} /> : null}

          {spec ? (
            <Box sx={{ mt: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="overline" color="text.secondary">{t('importRequired')}</Typography>
              {spec.required.map((c) => <Chip key={c} size="small" color="primary" label={c} />)}
              {spec.optional.length > 0 ? (
                <>
                  <Typography variant="overline" color="text.secondary" sx={{ ml: 1 }}>{t('importOptional')}</Typography>
                  {spec.optional.map((c) => <Chip key={c} size="small" variant="outlined" label={c} />)}
                </>
              ) : null}
            </Box>
          ) : null}
        </Panel>
      </Box>

      {/* Server-side datasets, offered before the file picker: for anything
          large this is the path that actually works. */}
      <Box sx={{ mb: 3 }}>
        <Panel title={t('datasetsTitle')} hint={t('datasetsHint')} disablePadding>
          {datasets.loading ? <LoadingState /> : null}
          {(datasets.data ?? []).length === 0 && !datasets.loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              {t('datasetsNone')}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('importFile')}</TableCell>
                    <TableCell align="right">{t('datasetRows')}</TableCell>
                    <TableCell align="right">{t('datasetSize')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(datasets.data ?? []).map((d) => (
                    <TableRow key={d.name}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.name}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {d.files.map((f) => (
                            <Chip
                              key={f.file}
                              size="small"
                              variant="outlined"
                              label={`${f.kind} · ${f.rows.toLocaleString()}`}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{d.totalRows.toLocaleString()}</TableCell>
                      <TableCell align="right">{(d.totalBytes / 1e6).toFixed(1)} MB</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<StorageIcon />}
                          disabled={datasetBusy !== null}
                          onClick={() => void importDataset(d.name)}
                        >
                          {datasetBusy === d.name ? t('datasetImporting') : t('datasetImport')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {datasetBusy ? <LinearProgress /> : null}
        </Panel>
      </Box>

      {datasetBusy ? (
        <Alert severity="info" sx={{ mb: 3 }}>{t('datasetSlow')}</Alert>
      ) : null}

      {datasetResult ? (
        <Alert
          severity={datasetResult.totalRejected === 0 ? 'success' : 'warning'}
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle2">
            {datasetResult.dataset} — {datasetResult.totalAccepted.toLocaleString()} rows imported
            {datasetResult.totalRejected > 0
              ? `, ${datasetResult.totalRejected.toLocaleString()} rejected` : ''} in {datasetResult.seconds}s
          </Typography>
          <Typography variant="body2">
            {datasetResult.results.map((r) => `${r.kind} ${r.rowsAccepted.toLocaleString()}`).join(' · ')}
          </Typography>
        </Alert>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert> : null}

      {result ? (
        <Box sx={{ mb: 3 }}>
          <Alert
            severity={result.rowsRejected === 0 ? 'success' : result.rowsAccepted === 0 ? 'error' : 'warning'}
            sx={{ mb: result.errors.length ? 2 : 0 }}
          >
            {result.rowsAccepted} of {result.rowsTotal} rows imported
            {result.rowsRejected > 0 ? `, ${result.rowsRejected} rejected` : ''}.
          </Alert>

          {result.errors.length > 0 ? (
            <Card>
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 90 }}>{t('importLine')}</TableCell>
                      <TableCell>{t('importProblem')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={`${e.line}-${i}`}>
                        <TableCell sx={{ fontFamily: 'Roboto Mono, monospace' }}>{e.line}</TableCell>
                        <TableCell>{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : null}
        </Box>
      ) : null}

      <SectionHeading title={t('importHistory')} />
      <Card>
        {history.loading ? <LoadingState /> : null}
        {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : null}
        {(history.data ?? []).length === 0 && !history.loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            {t('importNoHistory')}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('importFile')}</TableCell>
                  <TableCell>{t('importKind')}</TableCell>
                  <TableCell align="right">{t('importAccepted')}</TableCell>
                  <TableCell align="right">{t('importRejected')}</TableCell>
                  <TableCell>{t('generatedAt')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(history.data ?? []).map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{batch.filename}</Typography></TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={batch.kind} /></TableCell>
                    <TableCell align="right">{batch.rowsAccepted}</TableCell>
                    <TableCell align="right" sx={{ color: batch.rowsRejected > 0 ? 'error.main' : undefined }}>
                      {batch.rowsRejected}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'Roboto Mono, monospace', fontSize: 11 }}>
                      {batch.importedAt.slice(0, 16).replace('T', ' ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
