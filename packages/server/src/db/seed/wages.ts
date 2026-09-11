/**
 * Monthly cost to the employer, by role, in Bangladeshi taka.
 *
 * Without this the product can say a machine displaces 34 people but not what
 * that is worth, and a factory cannot weigh the training bill against anything.
 * With it, payback period and the retrain-versus-replace comparison become
 * computable.
 *
 * PROVENANCE
 *
 * The Bangladesh Minimum Wage Board set the RMG sector minimum at BDT 12,500 in
 * December 2023, and reporting puts a sewing operator's total monthly income
 * with overtime and attendance bonuses at BDT 20,000-25,000. The operator and
 * helper bands below are anchored to those two figures; everything else is
 * scaled by grade and marked `estimated`.
 *
 * These are employer cost, not take-home pay: wage plus overtime, bonuses and
 * benefits. A real deployment replaces the table with the factory's payroll.
 */

export interface WageBandSeed {
  roleSlug: string;
  monthlyCostBdt: number;
  sourceRef: string;
  confidence: 'sourced' | 'estimated';
}

const ANCHORED = 'Bangladesh Minimum Wage Board 2023 (BDT 12,500 minimum); reported operator income BDT 20,000-25,000';
const SCALED = 'Scaled by grade from the anchored operator and helper bands';

export const wageBands: WageBandSeed[] = [
  { roleSlug: 'helper-operator', monthlyCostBdt: 14_000, sourceRef: ANCHORED, confidence: 'sourced' },
  { roleSlug: 'sewing-machine-operator', monthlyCostBdt: 22_000, sourceRef: ANCHORED, confidence: 'sourced' },

  { roleSlug: 'cutting-machine-operator', monthlyCostBdt: 23_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'fabric-spreader', monthlyCostBdt: 16_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'quality-inspector', monthlyCostBdt: 21_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'finishing-ironing-staff', monthlyCostBdt: 17_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'packing-staff', monthlyCostBdt: 15_500, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'washing-plant-operator', monthlyCostBdt: 20_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'embroidery-machine-operator', monthlyCostBdt: 23_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'screen-printing-operator', monthlyCostBdt: 21_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'store-inventory-clerk', monthlyCostBdt: 18_500, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'line-supervisor', monthlyCostBdt: 33_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'fabric-pattern-cutter', monthlyCostBdt: 29_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'maintenance-technician', monthlyCostBdt: 31_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'merchandiser', monthlyCostBdt: 46_000, sourceRef: SCALED, confidence: 'estimated' },
  { roleSlug: 'industrial-engineer', monthlyCostBdt: 56_000, sourceRef: SCALED, confidence: 'estimated' },
];
