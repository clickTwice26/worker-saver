/**
 * Feature extraction.
 *
 * Only features that could plausibly differ between two workers in the same
 * role are included — a feature constant within a role teaches the model
 * nothing the rule engine did not already know.
 *
 * Deliberately absent: age, wage, gender, formal qualification, and any
 * subjective aptitude rating. A model trained on those learns whichever bias
 * produced the historical decisions and launders it as a prediction. Where an
 * aptitude signal is genuinely useful, `time_to_competency_weeks` carries it —
 * an observed ramp-up rather than somebody's opinion of a person.
 */

const SKILL_ORDER: Record<string, number> = {
  entry: 0, semi_skilled: 1, skilled: 2, specialist: 3,
};

const LITERACY_ORDER: Record<string, number> = {
  none: 0, basic: 1, functional: 2, fluent: 3,
};

const DIGITAL_ORDER: Record<string, number> = {
  none: 0, basic: 1, confident: 2,
};

export const FEATURE_NAMES = [
  'tenure_years',
  'operations_known',
  'skill_grade',
  'operation_automatability',
  'primary_operation_share',
  'exposure_concentration',
  'time_to_competency_weeks',
  'prior_training_pass_rate',
  'literacy',
  'digital_comfort',
  'machine_displacement_per_unit',
  'role_base_risk',
  'trained_before_arrival',
] as const;

export interface FeatureInput {
  tenureMonths: number | null;
  operationsKnown: number | null;
  skillGrade: string;
  /** 0-100 automatability of the worker's primary operation. */
  operationAutomatability: number | null;
  /** 0-1 share of the worker's time on that operation. */
  primaryOperationShare: number | null;
  /** Weeks to reach standard output the last time they learned an operation. */
  timeToCompetencyWeeks: number | null;
  priorTrainings: number | null;
  priorTrainingsPassed: number | null;
  literacyLevel: string;
  digitalComfort: string;
  /** Workers one unit of the arriving machine displaces in this role. */
  machineDisplacementPerUnit: number | null;
  /** The rule engine's role-level score, carried in as a prior. */
  roleBaseRisk: number | null;
  trainedBeforeArrival: boolean;
}

/**
 * Build one feature row.
 *
 * Missing values fall back to a neutral constant rather than to zero: zero
 * tenure is a real and meaningful value, and conflating "new hire" with "we
 * don't know" teaches the model something false.
 */
export function toFeatureRow(input: FeatureInput): number[] {
  const automatability = (input.operationAutomatability ?? 50) / 100;
  const share = input.primaryOperationShare ?? 0.6;

  const trainings = input.priorTrainings ?? 0;
  const passed = input.priorTrainingsPassed ?? 0;
  // An untrained worker gets the neutral 0.5 rather than a 0/0 that would read
  // as a total failure rate.
  const passRate = trainings > 0 ? Math.min(1, passed / trainings) : 0.5;

  return [
    (input.tenureMonths ?? 24) / 12,
    input.operationsKnown ?? 1,
    SKILL_ORDER[input.skillGrade] ?? 1,
    automatability,
    share,
    // The interaction that matters: a highly automatable operation is only a
    // real exposure if the worker actually spends their time on it. Neither
    // factor alone says that, and a linear model cannot form the product itself.
    automatability * share,
    Math.min(input.timeToCompetencyWeeks ?? 6, 52) / 52,
    passRate,
    LITERACY_ORDER[input.literacyLevel] ?? 1.5,
    DIGITAL_ORDER[input.digitalComfort] ?? 1,
    input.machineDisplacementPerUnit ?? 0,
    (input.roleBaseRisk ?? 50) / 100,
    input.trainedBeforeArrival ? 1 : 0,
  ];
}
