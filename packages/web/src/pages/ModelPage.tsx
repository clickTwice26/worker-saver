import { useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tab, Tabs, Typography,
} from '@mui/material';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import type { ModelStatus, ModelTarget, TrainedModel } from '@ale/shared';
import { api, ApiRequestError } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t, formatNumber } from '../copy/index.ts';
import { ErrorState, LoadingState, Panel, SectionHeading, StatTile } from '../components/Primitives.tsx';

const SEVERITY = {
  no_data: 'info',
  insufficient_data: 'info',
  trained_not_active: 'warning',
  active: 'success',
} as const;

const FEATURE_LABEL: Record<string, string> = {
  tenure_years: 'Tenure (years)',
  operations_known: 'Operations the worker can run',
  skill_grade: 'Skill grade',
  operation_automatability: 'Automatability of their operation',
  machine_displacement_per_unit: 'Machine displacement per unit',
  role_base_risk: 'Rule-engine role score',
  trained_before_arrival: 'Trained before the arrival',
};

/**
 * The prediction model.
 *
 * The page is built around the honest state rather than the happy one. Most
 * factories will land here with no recorded outcomes, and the correct answer
 * then is that the rule engine is producing every score and why — not a
 * dashboard implying a model exists.
 */
export function ModelPage() {
  const { factory, refreshKey, bumpRefresh } = useApp();
  const [target, setTarget] = useState<ModelTarget>('displacement');
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ModelStatus | null>(null);

  const status = useAsync(() => api.modelStatus(factory.id, target), [factory.id, refreshKey, target]);
  const outcomes = useAsync(() => api.outcomeSummary(factory.id), [factory.id, refreshKey]);

  const trainNow = async () => {
    setTraining(true);
    setError(null);
    try {
      setFresh(await api.trainModel(factory.id, target));
      bumpRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setTraining(false);
    }
  };

  if (status.loading) return <LoadingState />;
  if (status.error) return <ErrorState message={status.error} onRetry={status.reload} />;

  const state = fresh ?? status.data;
  if (!state) return <ErrorState message="No model status returned." />;

  const model = state.model;
  const progress = Math.min(100, (state.outcomesRecorded / 40) * 100);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ maxWidth: '68ch' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('modelTitle2')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('modelIntro')}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ModelTrainingIcon />}
          disabled={training}
          onClick={() => void trainNow()}
        >
          {training ? t('modelTraining') : t('modelTrain')}
        </Button>
      </Box>

      {/* Two targets. Displacement is knowable only after a machine lands;
          retraining success is knowable weeks after a cohort runs, so its
          labels accrue far faster. */}
      <Tabs
        value={target}
        onChange={(_, v: ModelTarget) => { setTarget(v); setFresh(null); }}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="displacement" label={t('targetDisplacement')} />
        <Tab value="retraining_success" label={t('targetRetraining')} />
      </Tabs>

      {error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert> : null}

      <Alert severity={SEVERITY[state.status]} sx={{ mb: 3 }}>
        <Typography variant="subtitle2">{t(`modelState_${state.status}` as never)}</Typography>
        <Typography variant="body2">{state.message}</Typography>
      </Alert>

      <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatTile
          label={t('modelOutcomes')}
          value={formatNumber(state.outcomesRecorded)}
          note={state.sampled && state.rowsUsed !== null
            ? `${formatNumber(state.rowsUsed)} ${t('modelRowsFitted')}`
            : t('modelOutcomesNote')}
        />
        <StatTile label={t('modelDisplaced')} value={formatNumber(state.displacedRecorded)} />
        <StatTile label={t('modelRetained')} value={formatNumber(state.retainedRecorded)} />
        <StatTile
          label={t('modelAuc')}
          value={model?.auc === null || model?.auc === undefined ? '—' : model.auc.toFixed(3)}
          note={
            model?.aucCiLow != null && model?.aucCiHigh != null
              ? `95% CI ${model.aucCiLow.toFixed(3)}–${model.aucCiHigh.toFixed(3)}`
              : model?.baselineAuc != null
                ? `${t('modelBaseline')} ${model.baselineAuc.toFixed(3)}`
                : t('modelNotTrained')
          }
        />
      </Box>

      {state.outcomesNeeded > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelProgress')} hint={t('modelProgressHint')}>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {formatNumber(state.outcomesRecorded)} / 40 — {formatNumber(state.outcomesNeeded)} {t('modelMoreNeeded')}
            </Typography>
          </Panel>
        </Box>
      ) : null}

      {model ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelMetrics')} hint={t('modelMetricsHint')}>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <Metric label={t('modelAlgorithm')} value={model.algorithm} />
                  <Metric
                    label={t('modelAuc')}
                    value={model.auc === null ? '—'
                      : `${model.auc.toFixed(4)}${model.aucCiLow !== null && model.aucCiHigh !== null
                        ? `  [${model.aucCiLow.toFixed(4)}, ${model.aucCiHigh.toFixed(4)}]` : ''}`}
                  />
                  <Metric label={t('modelPrecision')} value={model.precision?.toFixed(3) ?? '—'} />
                  <Metric label={t('modelRecall')} value={model.recall?.toFixed(3) ?? '—'} />
                  <Metric label={t('modelF1')} value={model.f1?.toFixed(3) ?? '—'} />
                  <Metric label={t('modelHyperparameters')} value={JSON.stringify(model.hyperparameters)} />
                  <Metric label={t('modelBaselineAuc')} value={model.baselineAuc?.toFixed(4) ?? '—'} />
                  <Metric label={t('modelBrier')} value={model.brier?.toFixed(4) ?? '—'} />
                  <Metric label={t('modelAccuracy')} value={model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : '—'} />
                  <Metric label={t('modelSamples')} value={`${formatNumber(model.nSamples)} (${formatNumber(model.nPositive)} displaced)`} />
                  <Metric label={t('modelFolds')} value={`${model.folds}-fold, stratified`} />
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>{t('modelInProduction')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={model.isActive ? 'low' : 'moderate'}
                        label={model.isActive ? t('modelActive') : t('modelInactive')}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>
        </Box>
      ) : null}

      {state.influence.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelInfluence')} hint={t('modelInfluenceHint')}>
            {state.influence.map((f) => {
              const max = Math.max(...state.influence.map((x) => Math.abs(x.weight))) || 1;
              return (
                <Box key={f.feature} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '230px 1fr 76px' }, gap: 1.5, alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">{FEATURE_LABEL[f.feature] ?? f.feature}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(Math.abs(f.weight) / max) * 100}
                    color={f.weight >= 0 ? 'error' : 'low'}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: { sm: 'right' }, fontVariantNumeric: 'tabular-nums' }}>
                    {f.weight >= 0 ? '+' : ''}{f.weight.toFixed(3)}
                  </Typography>
                </Box>
              );
            })}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              {t('modelInfluenceFoot')}
            </Typography>
          </Panel>
        </Box>
      ) : null}

      {model && model.candidates.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelCandidates')} hint={t('modelCandidatesHint')}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('modelAlgorithm')}</TableCell>
                    <TableCell>{t('modelHyperparameters')}</TableCell>
                    <TableCell align="right">{t('modelAuc')}</TableCell>
                    <TableCell align="right">{t('modelBrier')}</TableCell>
                    <TableCell align="right">{t('modelRecall')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {model.candidates.map((c, i) => {
                    const won = c.algorithm === model.algorithm
                      && JSON.stringify(c.hyperparameters) === JSON.stringify(model.hyperparameters);
                    return (
                      <TableRow key={`${c.algorithm}-${i}`}>
                        <TableCell><Typography variant="body2">{c.algorithm}</Typography></TableCell>
                        <TableCell sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11 }}>
                          {JSON.stringify(c.hyperparameters)}
                        </TableCell>
                        <TableCell align="right">{c.auc?.toFixed(4) ?? '—'}</TableCell>
                        <TableCell align="right">{c.brier.toFixed(4)}</TableCell>
                        <TableCell align="right">{c.recall.toFixed(3)}</TableCell>
                        <TableCell>
                          {won ? <Chip size="small" color="low" label={t('modelSelected')} /> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>
        </Box>
      ) : null}

      {model && model.learningCurve.length > 1 ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelLearningCurve')} hint={t('modelLearningCurveHint')}>
            <LearningCurve model={model} />
          </Panel>
        </Box>
      ) : null}

      {model && model.calibration.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Panel title={t('modelCalibration')} hint={t('modelCalibrationHint')}>
            <Calibration model={model} />
          </Panel>
        </Box>
      ) : null}

      <SectionHeading title={t('modelOutcomesByRole')} />
      <Card>
        {(outcomes.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            {t('modelNoOutcomes')}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('role')}</TableCell>
                  <TableCell>{t('modelOutcome')}</TableCell>
                  <TableCell align="right">{t('modelCount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(outcomes.data ?? []).map((row, i) => (
                  <TableRow key={`${row.roleLabel}-${row.outcome}-${i}`}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{row.roleLabel}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={row.outcome === 'displaced' ? 'error' : row.outcome === 'redeployed' ? 'moderate' : 'low'}
                        label={row.outcome}
                      />
                    </TableCell>
                    <TableCell align="right">{formatNumber(row.count)}</TableCell>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 500, width: 260 }}>{label}</TableCell>
      <TableCell sx={{ fontFamily: 'Roboto Mono, monospace' }}>{value}</TableCell>
    </TableRow>
  );
}


/**
 * Does AUC still climb with sample size?
 *
 * A curve still rising at the right-hand end says recording more outcomes is
 * worth the effort. One that has flattened says the limit is the features.
 */
function LearningCurve({ model }: { model: TrainedModel }) {
  const points = model.learningCurve.filter((p) => p.auc !== null);
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.auc!));

  return (
    <>
      {points.map((p) => (
        <Box key={p.n} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '110px 1fr 70px' }, gap: 1.5, alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">n = {formatNumber(p.n)}</Typography>
          <LinearProgress variant="determinate" value={(p.auc! / Math.max(max, 0.001)) * 100} />
          <Typography variant="caption" sx={{ textAlign: { sm: 'right' }, fontVariantNumeric: 'tabular-nums' }}>
            {p.auc!.toFixed(3)}
          </Typography>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {t('modelLearningCurveFoot')}
      </Typography>
    </>
  );
}

/**
 * Does a predicted 0.7 actually happen 70% of the time?
 *
 * Ranking and calibration are different properties, and this number is read as
 * a probability rather than as a rank.
 */
function Calibration({ model }: { model: TrainedModel }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell align="right">{t('modelPredicted')}</TableCell>
            <TableCell align="right">{t('modelObserved')}</TableCell>
            <TableCell align="right">{t('modelCount')}</TableCell>
            <TableCell>{t('modelGap')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {model.calibration.map((bin, i) => {
            const gap = bin.observed - bin.predicted;
            return (
              <TableRow key={i}>
                <TableCell align="right">{bin.predicted.toFixed(2)}</TableCell>
                <TableCell align="right">{bin.observed.toFixed(2)}</TableCell>
                <TableCell align="right">{formatNumber(bin.count)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={Math.abs(gap) < 0.1 ? 'low' : Math.abs(gap) < 0.2 ? 'moderate' : 'error'}
                    label={`${gap >= 0 ? '+' : ''}${gap.toFixed(2)}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
