/**
 * Core domain vocabulary, shared by the engine, the API and the interface.
 *
 * Types are declared once here so a rename shows up as a compile error on both
 * sides of the wire rather than as a silently empty field in the browser.
 */

/** Risk bands. Ordered most to least exposed. */
export type RiskBand = 'high' | 'moderate' | 'low';

/**
 * How much we trust a risk row.
 *
 * Every seeded row in v1 is `estimated` — the numbers come from the ALE Insight
 * dashboard concept, which is demo data, not measurement. The product says so
 * out loud rather than presenting an estimate as a finding.
 */
export type Confidence = 'sourced' | 'estimated';

/** Where a training cohort stands relative to the machine it prepares for. */
export type ScheduleStatus = 'on_track' | 'starts_soon' | 'overdue';

/** Where a role sits on the factory floor. Groups the knowledge base view. */
export type Department = 'cutting' | 'sewing' | 'finishing' | 'support' | 'technical';

export interface Role {
  id: number;
  slug: string;
  label: string;
  department: Department;
  /** Alternate spellings accepted on input, so free text still resolves. */
  synonyms: string[];
}

export interface Factory {
  id: number;
  name: string;
  location: string;
  productMix: string;
  isDemo: boolean;
  /** Roster size, so the switcher can show scale without a second request. */
  workforceSize: number;
}

export interface RoleHeadcount {
  factoryId: number;
  roleId: number;
  roleSlug: string;
  roleLabel: string;
  headcount: number;
}

export type MachineCategory =
  | 'cutting' | 'sewing' | 'finishing' | 'printing' | 'handling' | 'inspection' | 'systems';

export type AutomationLevel = 'assisted' | 'semi_automatic' | 'fully_automatic';

export type SkillLevel = 'entry' | 'semi_skilled' | 'skilled' | 'specialist';

/** A granular task on the factory floor. Machines replace these, not roles. */
export interface Operation {
  id: number;
  code: string;
  name: string;
  roleId: number;
  roleSlug: string;
  /** 0-100, on the same scale as a risk score. */
  automatability: number;
  skillLevel: SkillLevel;
}

/**
 * A machine in the reference catalogue.
 *
 * This is what lets the product compute displacement instead of asking the
 * factory to estimate it.
 */
export interface MachineType {
  id: number;
  slug: string;
  name: string;
  category: MachineCategory;
  automationLevel: AutomationLevel;
  capitalCostBdt: number;
  installLeadWeeks: number;
  /** People needed per unit. Fractional where one operator tends several. */
  operatorsRequired: number;
  operatorSkillLevel: SkillLevel;
  maintenanceHoursPerMonth: number;
  /** Output of one unit expressed in manual workers. */
  throughputWorkersEquivalent: number;
  /** Set where the machine removes work that is hazardous to do by hand. */
  healthSafetyNote: string | null;
  notes: string;
  sourceRef: string;
  confidence: Confidence;
  operations: MachineOperationLink[];
  impact: MachineRoleImpact[];
}

export interface MachineOperationLink {
  operationCode: string;
  operationName: string;
  /** Share of the operation the machine absorbs, 0-100. */
  coverage: number;
}

/** The two-sided effect of one unit on one role. */
export interface MachineRoleImpact {
  roleId: number;
  roleSlug: string;
  roleLabel: string;
  displacedPerUnit: number;
  createdPerUnit: number;
  rationale: string;
}

export interface MachineryPlan {
  id: number;
  factoryId: number;
  machineName: string;
  machineTypeId: number | null;
  machineTypeSlug: string | null;
  affectedRoleId: number;
  affectedRoleSlug: string;
  /** ISO date, `YYYY-MM-DD`. */
  arrivalDate: string;
  units: number;
  /** Null means the catalogue figure governs. A value overrides it. */
  headcountDisplacedPerUnit: number | null;
}

export interface RiskRule {
  id: number;
  roleId: number;
  roleSlug: string;
  machineTrigger: string;
  baseScore: number;
  band: RiskBand;
  /** Why this score. Shown in the product; a bare number is indefensible. */
  rationale: string;
  sourceRef: string;
  confidence: Confidence;
}

export interface TrainingProgram {
  id: number;
  name: string;
  targetRoleId: number;
  durationWeeks: number;
  seatsPerMonth: number;
  costPerSeatBdt: number;
  provider: string;
}

export interface AnalysisRun {
  id: number;
  factoryId: number;
  /** ISO timestamp the run executed. */
  runAt: string;
  /** Date the run treated as "today". Makes a run reproducible. */
  asOfDate: string;
  rulesVersion: string;
  engineVersion: string;
  findingCount: number;
}

/**
 * One finding: a role, a machine that affects it, and the training that answers it.
 *
 * There is no shape in this system that carries a risk score without the
 * training programme attached — see `docs/ethics.md`.
 */
export interface Finding {
  id: number;
  runId: number;

  roleId: number;
  roleSlug: string;
  roleLabel: string;
  headcount: number;

  machineryPlanId: number;
  machineName: string;
  arrivalDate: string;
  monthsUntilImpact: number;

  riskScore: number;
  riskBand: RiskBand;
  /** Whether the score came from the knowledge base or from a trained model. */
  scoreSource: 'rules' | 'model';
  rationale: string;
  sourceRef: string;
  confidence: Confidence;

  /** Workers this arrival is expected to displace. */
  workersAffected: number;
  /** New posts the same machine creates in this role — operators to run it. */
  workersCreated: number;
  /** displaced - created. Frequently not the figure a factory expects. */
  netWorkforceChange: number;
  /** True when displacement was derived from the catalogue, not typed in. */
  derivedFromCatalogue: boolean;
  machineTypeName: string | null;
  /** Present where the machine removes hazardous manual work. */
  healthSafetyNote: string | null;

  /** Monthly wage bill removed by the net displacement, in taka. */
  monthlyLabourSavingBdt: number;
  /** Capital cost of the units in this arrival. */
  capitalCostBdt: number;
  /** Months for the labour saving to repay the capital. Null if it never does. */
  paybackMonths: number | null;
  /** Training this cohort, against one year of the wage bill it replaces. */
  retrainingCostRatio: number | null;

  trainingProgramId: number;
  trainingProgramName: string;
  trainingProvider: string;
  trainingDurationWeeks: number;
  trainingSeatsPerMonth: number;
  trainingCostPerSeatBdt: number;

  /** The schedule. This is the part a factory cannot work out on its own. */
  cohortsRequired: number;
  /** Latest date training can begin and still finish before the machine lands. */
  startByDate: string;
  scheduleStatus: ScheduleStatus;
  /** Negative when `startByDate` has already passed. */
  daysUntilStartBy: number;
  estimatedCostBdt: number;
}

/** A single month in the training calendar. */
export interface ScheduleMonth {
  /** `YYYY-MM`. */
  month: string;
  entries: ScheduleEntry[];
  seatsThisMonth: number;
  costThisMonthBdt: number;
}

export interface ScheduleEntry {
  findingId: number;
  roleSlug: string;
  roleLabel: string;
  trainingProgramName: string;
  seats: number;
  cohortIndex: number;
  cohortsTotal: number;
  /** The arrival this cohort is racing. */
  machineName: string;
  arrivalDate: string;
}

/** Everything needed to render the plan and the report for one run. */
export interface TransitionPlan {
  run: AnalysisRun;
  factory: Factory;
  /** The full roster, including roles no machine currently threatens. */
  roster: RoleHeadcount[];
  findings: Finding[];
  schedule: ScheduleMonth[];
  totals: PlanTotals;
}

export interface PlanTotals {
  workforceModelled: number;
  rolesTracked: number;
  workersAffected: number;
  rolesAtHighRisk: number;
  totalCostBdt: number;
  totalSeats: number;
  /** Findings whose `startByDate` has already passed. */
  overdueCount: number;
  /** Weighted by headcount, so a big role moves it more than a small one. */
  weightedRiskScore: number;
  earliestArrival: string | null;

  /** New posts created across all arrivals. */
  workersCreated: number;
  /** Net workforce change: created minus displaced. Negative means shrinkage. */
  netWorkforceChange: number;
  totalCapitalCostBdt: number;
  monthlyLabourSavingBdt: number;
  /** Findings whose machine removes hazardous manual work. */
  healthSafetyCount: number;
}
