/**
 * The canonical role taxonomy.
 *
 * Sixteen roles covering a ready-made garment floor from fabric store to
 * finishing. The first eight are the roles modelled in the ALE Insight dashboard
 * concept and keep its published headcounts; the remainder are roles a factory
 * of that size actually employs and which the concept did not track.
 *
 * `synonyms` is the fix for the defect in the v1 specification: the supporting
 * documents spell the same role three different ways, and the specified engine
 * matched on exact string equality, so its first run would have returned
 * nothing. Every spelling below resolves to one id.
 */

export interface RoleSeed {
  slug: string;
  label: string;
  /** Where the role sits on the floor. Groups the knowledge base view. */
  department: 'cutting' | 'sewing' | 'finishing' | 'support' | 'technical';
  synonyms: string[];
}

export const roles: RoleSeed[] = [
  {
    slug: 'sewing-machine-operator',
    label: 'Sewing Machine Operators',
    department: 'sewing',
    synonyms: ['sewing machine operator', 'sewing operator', 'sewing operators', 'swing operator', 'machinist'],
  },
  {
    slug: 'cutting-machine-operator',
    label: 'Cutting Machine Operators',
    department: 'cutting',
    // Both the singular and plural forms appeared in the specification.
    synonyms: ['cutting machine operator', 'cutting operator', 'cutting operators', 'cutter operator'],
  },
  {
    slug: 'quality-inspector',
    label: 'Quality Inspectors',
    department: 'finishing',
    synonyms: ['quality inspector', 'qc inspector', 'quality control inspector', 'qc', 'qa inspector'],
  },
  {
    slug: 'finishing-ironing-staff',
    label: 'Finishing & Ironing Staff',
    department: 'finishing',
    synonyms: ['finishing and ironing staff', 'finishing staff', 'ironing staff', 'iron man', 'presser'],
  },
  {
    slug: 'packing-staff',
    label: 'Packing Staff',
    department: 'finishing',
    synonyms: ['packing staff', 'packer', 'packers', 'packing'],
  },
  {
    slug: 'line-supervisor',
    label: 'Line Supervisors',
    department: 'support',
    synonyms: ['line supervisor', 'supervisor', 'supervisors', 'line chief'],
  },
  {
    slug: 'fabric-pattern-cutter',
    label: 'Fabric & Pattern Cutters',
    department: 'cutting',
    synonyms: ['fabric and pattern cutter', 'pattern cutter', 'pattern cutters', 'fabric cutter', 'pattern master'],
  },
  {
    slug: 'maintenance-technician',
    label: 'Maintenance Technicians',
    department: 'technical',
    synonyms: ['maintenance technician', 'technician', 'technicians', 'mechanic', 'machine mechanic'],
  },
  {
    slug: 'helper-operator',
    label: 'Helpers & Line Feeders',
    department: 'sewing',
    synonyms: ['helper', 'helpers', 'line helper', 'line feeder', 'assistant operator'],
  },
  {
    slug: 'fabric-spreader',
    label: 'Fabric Spreaders',
    department: 'cutting',
    synonyms: ['fabric spreader', 'spreader', 'spreaders', 'spreading operator'],
  },
  {
    slug: 'embroidery-machine-operator',
    label: 'Embroidery Machine Operators',
    department: 'sewing',
    synonyms: ['embroidery machine operator', 'embroidery operator', 'embroidery'],
  },
  {
    slug: 'screen-printing-operator',
    label: 'Screen Printing Operators',
    department: 'sewing',
    synonyms: ['screen printing operator', 'screen printer', 'printing operator', 'print operator'],
  },
  {
    slug: 'washing-plant-operator',
    label: 'Washing Plant Operators',
    department: 'finishing',
    synonyms: ['washing plant operator', 'washing operator', 'wash plant', 'laundry operator'],
  },
  {
    slug: 'store-inventory-clerk',
    label: 'Store & Inventory Clerks',
    department: 'support',
    synonyms: ['store and inventory clerk', 'store clerk', 'storekeeper', 'inventory clerk'],
  },
  {
    slug: 'merchandiser',
    label: 'Merchandisers',
    department: 'support',
    synonyms: ['merchandiser', 'merchandisers', 'merchandising'],
  },
  {
    slug: 'industrial-engineer',
    label: 'Industrial Engineers',
    department: 'technical',
    synonyms: ['industrial engineer', 'ie', 'ie officer', 'work study officer'],
  },
];
