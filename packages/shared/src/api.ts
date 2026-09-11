/** Request and response shapes for the HTTP API. */

import type {
  Factory,
  Finding,
  MachineryPlan,
  Role,
  RoleHeadcount,
  RiskRule,
  TrainingProgram,
  TransitionPlan,
  AnalysisRun,
} from './domain.ts';

/** Every error the API returns has this shape. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level detail for validation failures. */
    details?: Record<string, string>;
  };
}

export type ApiErrorCode =
  | 'validation_failed'
  | 'not_found'
  | 'role_not_resolved'
  | 'no_training_program'
  | 'conflict'
  | 'internal_error';

export interface HealthResponse {
  status: 'ok';
  engineVersion: string;
  rulesVersion: string;
  database: 'connected';
}

export type RolesResponse = Role[];
export type FactoriesResponse = Factory[];
export type RiskRulesResponse = RiskRule[];
export type TrainingProgramsResponse = TrainingProgram[];
export type HeadcountsResponse = RoleHeadcount[];
export type MachineryPlansResponse = MachineryPlan[];

export interface UpsertHeadcountRequest {
  /** Either a role id, or free text resolved through the synonym table. */
  roleId?: number;
  role?: string;
  headcount: number;
}

export interface CreateMachineryPlanRequest {
  machineName: string;
  /** Catalogue slug. Supplying it is what lets displacement be derived. */
  machineType?: string;
  roleId?: number;
  affectedRole?: string;
  /** `YYYY-MM-DD`. */
  arrivalDate: string;
  units?: number;
  /** Overrides the catalogue. Required only when `machineType` is omitted. */
  headcountDisplacedPerUnit?: number;
}

export interface RunAnalysisRequest {
  /** Overrides "today". Supplied by the golden test so runs are reproducible. */
  asOfDate?: string;
}

export interface RunAnalysisResponse {
  run: AnalysisRun;
  findingCount: number;
}

export type PlanResponse = TransitionPlan;
export type FindingsResponse = Finding[];

/**
 * The buyer-facing transition report.
 *
 * Deliberately a superset of the plan with commitments attached, and the only
 * exportable document the API produces. There is no endpoint that returns a
 * bare ranked risk list — see `docs/ethics.md`.
 */
export interface TransitionReport {
  plan: TransitionPlan;
  generatedAt: string;
  /** Plain-language commitments derived from the schedule. */
  commitments: ReportCommitment[];
  disclosure: string;
}

export interface ReportCommitment {
  roleLabel: string;
  workersAffected: number;
  trainingProgramName: string;
  startByDate: string;
  completesByDate: string;
  costBdt: number;
}

// --- real data operation ----------------------------------------------------

export type ImportKind = 'roster' | 'machinery' | 'workers' | 'outcomes';

export interface RowError {
  /** 1-based, counting the header, so it matches what a spreadsheet shows. */
  line: number;
  message: string;
}

export interface ImportResult {
  batchId: number;
  kind: ImportKind;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  errors: RowError[];
}

export interface ImportBatch {
  id: number;
  kind: ImportKind;
  filename: string;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  errors: RowError[];
  importedAt: string;
}

export type ImportColumns = Record<ImportKind, { required: string[]; optional: string[] }>;

export interface CreateFactoryRequest {
  name: string;
  location?: string;
  productMix?: string;
}

export type ModelTarget = 'displacement' | 'retraining_success';

export interface CalibrationBin {
  predicted: number;
  observed: number;
  count: number;
}

export interface ModelCandidate {
  algorithm: string;
  hyperparameters: Record<string, unknown>;
  auc: number | null;
  brier: number;
  recall: number;
}

export interface TrainedModel {
  id: number;
  target: ModelTarget;
  algorithm: string;
  hyperparameters: Record<string, number | boolean>;
  featureNames: string[];
  nSamples: number;
  nPositive: number;
  folds: number;
  /** Cross-validated, not training-set. */
  auc: number | null;
  /** Bootstrap 95% interval around that AUC. */
  aucCiLow: number | null;
  aucCiHigh: number | null;
  brier: number | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  /** The rule engine scored on the same held-out folds. */
  baselineAuc: number | null;
  beatsBaseline: boolean;
  isActive: boolean;
  calibration: CalibrationBin[];
  /** AUC lost when each feature is shuffled. */
  permutationImportance: Array<{ feature: string; weight: number }>;
  /** Whether more recorded outcomes would still help. */
  learningCurve: Array<{ n: number; auc: number | null }>;
  candidates: ModelCandidate[];
  trainedAt: string;
  notes: string;
}

export interface ModelStatus {
  status: 'no_data' | 'insufficient_data' | 'trained_not_active' | 'active';
  target: ModelTarget;
  message: string;
  outcomesRecorded: number;
  outcomesNeeded: number;
  displacedRecorded: number;
  retainedRecorded: number;
  /** Rows actually fitted, when the dataset was subsampled for tractability. */
  rowsUsed: number | null;
  sampled: boolean;
  model: TrainedModel | null;
  influence: Array<{ feature: string; weight: number }>;
}

export interface OutcomeSummaryRow {
  roleLabel: string;
  outcome: 'retained' | 'redeployed' | 'displaced';
  count: number;
}

export interface DatasetFile {
  kind: ImportKind;
  file: string;
  bytes: number;
  rows: number;
}

/** A generated CSV set sitting on the server, importable without an upload. */
export interface Dataset {
  name: string;
  files: DatasetFile[];
  totalBytes: number;
  totalRows: number;
}

export interface DatasetImportResult {
  dataset: string;
  results: ImportResult[];
  totalAccepted: number;
  totalRejected: number;
  seconds: number;
}
