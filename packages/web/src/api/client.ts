/**
 * Typed API client.
 *
 * Every response type comes from `@ale/shared`, so a change to the contract
 * fails the frontend build rather than showing up as a blank panel.
 */

import type {
  Factory, HeadcountsResponse, MachineryPlansResponse, PlanResponse,
  RiskRulesResponse, RolesResponse, TrainingProgramsResponse, TransitionReport, ApiError,
  MachineType, Operation, ImportKind, ImportResult, ImportBatch, ImportColumns,
  CreateFactoryRequest, ModelStatus, ModelTarget, OutcomeSummaryRow,
  Dataset, DatasetImportResult,
  CreateMachineryPlanRequest, UpsertHeadcountRequest, AnalysisRun,
} from '@ale/shared';

const BASE = '/api';

/** An error carrying the server's machine-readable code and field details. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiRequestError(0, 'network_error', 'Could not reach the API. Is the server running on port 7420?');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  // 422 from an import carries the row-level report, which is the useful
  // response, not a failure to surface as an exception.
  const isPartialImport = response.status === 422 && payload !== null
    && typeof payload === 'object' && 'rowsAccepted' in (payload as object);

  if (!response.ok && !isPartialImport) {
    const error = (payload as ApiError | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'internal_error',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  listFactories: () => request<Factory[]>('/factories'),
  listRoles: () => request<RolesResponse>('/roles'),
  listRiskRules: () => request<RiskRulesResponse>('/risk-rules'),
  listTrainingPrograms: () => request<TrainingProgramsResponse>('/training-programs'),
  listMachineTypes: () => request<MachineType[]>('/machine-types'),
  listOperations: () => request<Operation[]>('/operations'),

  listHeadcounts: (factoryId: number) =>
    request<HeadcountsResponse>(`/factories/${factoryId}/headcounts`),

  saveHeadcount: (factoryId: number, body: UpsertHeadcountRequest) =>
    request<HeadcountsResponse>(`/factories/${factoryId}/headcounts`, {
      method: 'PUT', body: JSON.stringify(body),
    }),

  listMachineryPlans: (factoryId: number) =>
    request<MachineryPlansResponse>(`/factories/${factoryId}/machinery-plans`),

  addMachineryPlan: (factoryId: number, body: CreateMachineryPlanRequest) =>
    request<MachineryPlansResponse[number]>(`/factories/${factoryId}/machinery-plans`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  removeMachineryPlan: (factoryId: number, planId: number) =>
    request<void>(`/factories/${factoryId}/machinery-plans/${planId}`, { method: 'DELETE' }),

  runAnalysis: (factoryId: number) =>
    request<{ run: AnalysisRun; findingCount: number }>(`/factories/${factoryId}/run-analysis`, {
      method: 'POST', body: JSON.stringify({}),
    }),

  createFactory: (body: CreateFactoryRequest) =>
    request<Factory>('/factories', { method: 'POST', body: JSON.stringify(body) }),

  deleteFactory: (factoryId: number) =>
    request<void>(`/factories/${factoryId}`, { method: 'DELETE' }),

  importColumns: () => request<ImportColumns>('/import/columns'),

  /** Partial success is normal: 422 carries the same body as 200. */
  importCsv: (factoryId: number, kind: ImportKind, csv: string, filename: string) =>
    request<ImportResult>(`/factories/${factoryId}/import/${kind}`, {
      method: 'POST', body: JSON.stringify({ csv, filename }),
    }),

  /** Generated CSV sets sitting on the server, importable without an upload. */
  listDatasets: () => request<Dataset[]>('/datasets'),

  importDataset: (factoryId: number, name: string) =>
    request<DatasetImportResult>(`/factories/${factoryId}/datasets/${encodeURIComponent(name)}/import`, {
      method: 'POST', body: '{}',
    }),

  listImports: (factoryId: number) =>
    request<ImportBatch[]>(`/factories/${factoryId}/imports`),

  outcomeSummary: (factoryId: number) =>
    request<OutcomeSummaryRow[]>(`/factories/${factoryId}/outcomes/summary`),

  modelStatus: (factoryId: number, target: ModelTarget = 'displacement') =>
    request<ModelStatus>(`/factories/${factoryId}/model?target=${target}`),

  trainModel: (factoryId: number, target: ModelTarget = 'displacement') =>
    request<ModelStatus>(`/factories/${factoryId}/model/train`, {
      method: 'POST', body: JSON.stringify({ target }),
    }),

  getPlan: (factoryId: number) => request<PlanResponse>(`/factories/${factoryId}/plan`),
  getReport: (factoryId: number) => request<TransitionReport>(`/factories/${factoryId}/report`),
};
