/**
 * The training catalogue.
 *
 * Without this table, "recommended training" is a sentence. With it, the engine
 * can answer the question a factory actually has: how many months of lead time
 * does this machine purchase require, and what will it cost.
 *
 * Durations, seat capacities and costs are illustrative defaults sized for a
 * mid-to-large Dhaka factory. A real deployment replaces them with the factory's
 * own provider arrangements during onboarding — seat capacity is the binding
 * constraint in every schedule the engine produces, so a wrong number here
 * changes the answer, not just the presentation.
 *
 * Costs are in Bangladeshi taka, per seat.
 */

export interface TrainingProgramSeed {
  name: string;
  targetRoleSlug: string;
  durationWeeks: number;
  seatsPerMonth: number;
  costPerSeatBdt: number;
  provider: string;
}

export const trainingPrograms: TrainingProgramSeed[] = [
  {
    name: 'Automated cutter supervision & calibration',
    targetRoleSlug: 'cutting-machine-operator',
    durationWeeks: 3, seatsPerMonth: 12, costPerSeatBdt: 8500,
    provider: 'In-house + equipment vendor',
  },
  {
    name: 'Multi-skill operation & inline quality control',
    targetRoleSlug: 'sewing-machine-operator',
    durationWeeks: 6, seatsPerMonth: 40, costPerSeatBdt: 6200,
    provider: 'In-house training cell',
  },
  {
    name: 'Packing-line redesign pilot',
    targetRoleSlug: 'packing-staff',
    durationWeeks: 2, seatsPerMonth: 25, costPerSeatBdt: 4800,
    provider: 'In-house',
  },
  {
    name: 'Finishing transition & redeployment track',
    targetRoleSlug: 'finishing-ironing-staff',
    durationWeeks: 4, seatsPerMonth: 30, costPerSeatBdt: 5500,
    provider: 'In-house',
  },
  {
    name: 'Digital pattern design (CAD)',
    targetRoleSlug: 'fabric-pattern-cutter',
    durationWeeks: 8, seatsPerMonth: 10, costPerSeatBdt: 12000,
    provider: 'External — technical institute',
  },
  {
    name: 'AI-assisted defect scanning',
    targetRoleSlug: 'quality-inspector',
    durationWeeks: 4, seatsPerMonth: 20, costPerSeatBdt: 7000,
    provider: 'Equipment vendor',
  },
  {
    name: 'Dashboard-driven line management',
    targetRoleSlug: 'line-supervisor',
    durationWeeks: 3, seatsPerMonth: 15, costPerSeatBdt: 9500,
    provider: 'In-house',
  },
  {
    name: 'Robotics & automated equipment maintenance',
    targetRoleSlug: 'maintenance-technician',
    durationWeeks: 12, seatsPerMonth: 8, costPerSeatBdt: 18000,
    provider: 'External — technical institute',
  },
  {
    name: 'Spreader-to-cutting-room technician track',
    targetRoleSlug: 'fabric-spreader',
    durationWeeks: 5, seatsPerMonth: 10, costPerSeatBdt: 9200,
    provider: 'In-house + equipment vendor',
  },
  {
    name: 'Laser & ozone finishing operation',
    targetRoleSlug: 'washing-plant-operator',
    durationWeeks: 6, seatsPerMonth: 12, costPerSeatBdt: 14500,
    provider: 'Equipment vendor',
  },
  {
    name: 'Digital print operation & colour management',
    targetRoleSlug: 'screen-printing-operator',
    durationWeeks: 5, seatsPerMonth: 10, costPerSeatBdt: 11000,
    provider: 'Equipment vendor',
  },
  {
    name: 'RFID stock control & systems handling',
    targetRoleSlug: 'store-inventory-clerk',
    durationWeeks: 3, seatsPerMonth: 15, costPerSeatBdt: 6800,
    provider: 'In-house',
  },
  {
    // Deliberately the widest intake in the catalogue: helpers are the entry
    // point into the factory, and a narrow pipeline here closes progression.
    name: 'Helper-to-operator progression track',
    targetRoleSlug: 'helper-operator',
    durationWeeks: 8, seatsPerMonth: 60, costPerSeatBdt: 5200,
    provider: 'In-house training cell',
  },
  {
    name: 'Multi-head embroidery & digitising',
    targetRoleSlug: 'embroidery-machine-operator',
    durationWeeks: 4, seatsPerMonth: 8, costPerSeatBdt: 10500,
    provider: 'Equipment vendor',
  },
  {
    name: 'Digital merchandising & costing tools',
    targetRoleSlug: 'merchandiser',
    durationWeeks: 3, seatsPerMonth: 12, costPerSeatBdt: 13000,
    provider: 'External — professional body',
  },
  {
    name: 'Advanced work study & line-balancing analytics',
    targetRoleSlug: 'industrial-engineer',
    durationWeeks: 6, seatsPerMonth: 6, costPerSeatBdt: 21000,
    provider: 'External — technical institute',
  },
];
