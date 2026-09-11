/**
 * The operations catalogue.
 *
 * Machines do not replace roles; they replace *operations*, and roles lose
 * headcount in proportion to how much of their work a machine absorbs. This is
 * also the field that would make worker-level scoring meaningful: within
 * "sewing machine operator", someone running a straight seam is far more
 * exposed than someone doing complex assembly, and only the operation says so.
 *
 * `automatability` is 0-100 on the same scale as a risk score, derived from how
 * specifiable the task is and how completely current equipment covers it.
 */

export interface OperationSeed {
  code: string;
  name: string;
  roleSlug: string;
  automatability: number;
  skillLevel: 'entry' | 'semi_skilled' | 'skilled' | 'specialist';
}

export const operations: OperationSeed[] = [
  // Cutting room
  { code: 'spread-ply-lay', name: 'Spread and lay fabric plies', roleSlug: 'fabric-spreader', automatability: 92, skillLevel: 'entry' },
  { code: 'cut-marker-panels', name: 'Cut panels to marker', roleSlug: 'cutting-machine-operator', automatability: 88, skillLevel: 'semi_skilled' },
  { code: 'cut-notch-drill', name: 'Notch and drill reference points', roleSlug: 'cutting-machine-operator', automatability: 84, skillLevel: 'semi_skilled' },
  { code: 'make-marker', name: 'Make cutting marker', roleSlug: 'fabric-pattern-cutter', automatability: 78, skillLevel: 'skilled' },
  { code: 'grade-pattern', name: 'Grade pattern across sizes', roleSlug: 'fabric-pattern-cutter', automatability: 55, skillLevel: 'specialist' },

  // Sewing floor
  { code: 'sew-straight-seam', name: 'Sew straight seam', roleSlug: 'sewing-machine-operator', automatability: 86, skillLevel: 'semi_skilled' },
  { code: 'sew-hem', name: 'Hem edge', roleSlug: 'sewing-machine-operator', automatability: 72, skillLevel: 'semi_skilled' },
  { code: 'sew-attach-pocket', name: 'Attach pocket', roleSlug: 'sewing-machine-operator', automatability: 64, skillLevel: 'skilled' },
  { code: 'sew-set-sleeve', name: 'Set sleeve', roleSlug: 'sewing-machine-operator', automatability: 31, skillLevel: 'skilled' },
  { code: 'sew-assemble-collar', name: 'Assemble and attach collar', roleSlug: 'sewing-machine-operator', automatability: 24, skillLevel: 'skilled' },
  { code: 'move-bundles', name: 'Move bundles between stations', roleSlug: 'helper-operator', automatability: 89, skillLevel: 'entry' },
  { code: 'trim-thread', name: 'Trim threads and clean garment', roleSlug: 'helper-operator', automatability: 46, skillLevel: 'entry' },
  { code: 'embroider-run', name: 'Run embroidery head bank', roleSlug: 'embroidery-machine-operator', automatability: 74, skillLevel: 'semi_skilled' },
  { code: 'print-screen-prep', name: 'Prepare and register print screens', roleSlug: 'screen-printing-operator', automatability: 91, skillLevel: 'skilled' },
  { code: 'print-apply', name: 'Apply print to garment', roleSlug: 'screen-printing-operator', automatability: 68, skillLevel: 'semi_skilled' },

  // Finishing and washing
  { code: 'press-bulk', name: 'Bulk press garments', roleSlug: 'finishing-ironing-staff', automatability: 81, skillLevel: 'entry' },
  { code: 'press-final', name: 'Final presentation press', roleSlug: 'finishing-ironing-staff', automatability: 34, skillLevel: 'semi_skilled' },
  { code: 'wash-hand-sand', name: 'Hand sand and scrape denim', roleSlug: 'washing-plant-operator', automatability: 96, skillLevel: 'semi_skilled' },
  { code: 'wash-stone-cycle', name: 'Run stone / enzyme wash cycle', roleSlug: 'washing-plant-operator', automatability: 70, skillLevel: 'semi_skilled' },
  { code: 'inspect-visual', name: 'Visual defect inspection', roleSlug: 'quality-inspector', automatability: 62, skillLevel: 'semi_skilled' },
  { code: 'inspect-measure', name: 'Measurement and spec check', roleSlug: 'quality-inspector', automatability: 48, skillLevel: 'skilled' },
  { code: 'inspect-rework-call', name: 'Rework and tolerance decisions', roleSlug: 'quality-inspector', automatability: 12, skillLevel: 'skilled' },
  { code: 'pack-carton', name: 'Fold, bag and carton garments', roleSlug: 'packing-staff', automatability: 76, skillLevel: 'entry' },
  { code: 'pack-label-scan', name: 'Label and scan cartons', roleSlug: 'packing-staff', automatability: 93, skillLevel: 'entry' },

  // Support and technical
  { code: 'stock-count', name: 'Count and reconcile stock', roleSlug: 'store-inventory-clerk', automatability: 90, skillLevel: 'entry' },
  { code: 'stock-issue', name: 'Issue materials to lines', roleSlug: 'store-inventory-clerk', automatability: 41, skillLevel: 'semi_skilled' },
  { code: 'balance-line', name: 'Balance line and allocate operators', roleSlug: 'line-supervisor', automatability: 29, skillLevel: 'skilled' },
  { code: 'escalate-stoppage', name: 'Diagnose and escalate line stoppages', roleSlug: 'line-supervisor', automatability: 11, skillLevel: 'skilled' },
  { code: 'service-machine', name: 'Service and repair machines', roleSlug: 'maintenance-technician', automatability: 9, skillLevel: 'skilled' },
  { code: 'cost-order', name: 'Cost and schedule an order', roleSlug: 'merchandiser', automatability: 52, skillLevel: 'skilled' },
  { code: 'manage-buyer', name: 'Manage buyer relationship', roleSlug: 'merchandiser', automatability: 7, skillLevel: 'specialist' },
  { code: 'time-study', name: 'Time study and method analysis', roleSlug: 'industrial-engineer', automatability: 44, skillLevel: 'specialist' },
];
