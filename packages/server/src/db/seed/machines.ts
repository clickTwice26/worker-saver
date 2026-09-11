/**
 * The machine catalogue.
 *
 * PROVENANCE
 *
 * Rows marked `sourced` carry figures reported in the references below. Rows
 * marked `estimated` are reasoned from the same method where no published
 * figure was found, and the interface shows that marking beside the number.
 *
 *   [CNC]   Automatic CNC cutters: "the entire process operation only requires
 *           no more than 2 workers" and "one machine equals the productivity of
 *           4-10 workers"; cutting speeds 8-120 m/min by model.
 *           onlineclothingstudy.com / trustercnc.com
 *   [AUTO]  Automated sewing in Bangladeshi factories: "a single worker can run
 *           six automated machines, delivering four to five times more
 *           productivity"; semi-automatic installs raised output 5-10%, IoT
 *           line monitoring up to 25%. tbsnews.net
 *   [LASER] Laser finishing "entirely replaced manual scraping"; ozone replaced
 *           stone washing; process steps cut from 90 to 15; adopted by >70% of
 *           denim manufacturers. jeanologia.com / texpertisenetwork
 *
 * Capital costs are order-of-magnitude figures for planning, not quotations.
 * A real deployment replaces them with the factory's own vendor pricing.
 */

export interface MachineTypeSeed {
  slug: string;
  name: string;
  category: 'cutting' | 'sewing' | 'finishing' | 'printing' | 'handling' | 'inspection' | 'systems';
  automationLevel: 'assisted' | 'semi_automatic' | 'fully_automatic';
  capitalCostBdt: number;
  installLeadWeeks: number;
  /** People needed to run one unit. Fractional where one operator tends several. */
  operatorsRequired: number;
  operatorSkillLevel: 'entry' | 'semi_skilled' | 'skilled' | 'specialist';
  maintenanceHoursPerMonth: number;
  /** Output of one unit, expressed in manual workers. */
  throughputWorkersEquivalent: number;
  healthSafetyNote?: string;
  notes: string;
  sourceRef: string;
  confidence: 'sourced' | 'estimated';
  /** Operations this machine absorbs, and how much of each. */
  operations: Array<{ code: string; coverage: number }>;
  /** The two-sided workforce effect, per unit. */
  impact: Array<{
    roleSlug: string;
    displacedPerUnit?: number;
    createdPerUnit?: number;
    rationale: string;
  }>;
}

const CNC = 'Reported CNC cutter specifications (onlineclothingstudy.com, trustercnc.com)';
const AUTO = 'Reported Bangladeshi factory automation outcomes (tbsnews.net)';
const LASER = 'Reported laser/ozone denim finishing outcomes (jeanologia.com, texpertisenetwork)';
const EST = 'ALE Insight machine catalogue v1, reasoned estimate pending vendor confirmation';

export const machineTypes: MachineTypeSeed[] = [
  {
    slug: 'automated-laser-cutter',
    name: 'Automated laser / CNC fabric cutter',
    category: 'cutting',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 8_500_000,
    installLeadWeeks: 8,
    // Reported as requiring "no more than 2 workers" to operate.
    operatorsRequired: 2,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 12,
    // Reported as equalling "the productivity of 4-10 workers"; midpoint taken.
    throughputWorkersEquivalent: 7,
    notes:
      'Cutting speeds range from 8 to 120 m/min depending on model, fabric and ply count, so the ' +
      'displacement figure varies more by configuration than by vendor.',
    sourceRef: CNC,
    confidence: 'sourced',
    operations: [
      { code: 'cut-marker-panels', coverage: 95 },
      { code: 'cut-notch-drill', coverage: 90 },
    ],
    impact: [
      {
        roleSlug: 'cutting-machine-operator',
        displacedPerUnit: 7,
        createdPerUnit: 2,
        rationale:
          'One unit does the work of about seven manual cutters but needs two operators to run it, ' +
          'so the net effect per unit is five — and the two retained posts are a promotion, not a ' +
          'survival, provided the training happens before the machine lands.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.3,
        rationale: 'Roughly 12 service hours a month per unit, which is about a third of a technician post.',
      },
    ],
  },

  {
    slug: 'automatic-spreading-machine',
    name: 'Automatic fabric spreading machine',
    category: 'cutting',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 3_200_000,
    installLeadWeeks: 6,
    operatorsRequired: 1,
    operatorSkillLevel: 'semi_skilled',
    maintenanceHoursPerMonth: 8,
    throughputWorkersEquivalent: 5,
    notes:
      'Machine-controlled tension, speed and edge alignment remove the manual spreading table almost ' +
      'entirely. Manual spreading stays viable only for short runs and low daily cutting volume.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'spread-ply-lay', coverage: 95 }],
    impact: [
      {
        roleSlug: 'fabric-spreader',
        displacedPerUnit: 5,
        createdPerUnit: 1,
        rationale:
          'Spreading is the most commonly automated step in the cutting room. The residual role is ' +
          'loading and supervision — one post per machine.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.2,
        rationale: 'Light servicing load, roughly a fifth of a post per unit.',
      },
    ],
  },

  {
    slug: 'automated-sewing-unit',
    name: 'Automated sewing unit',
    category: 'sewing',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 950_000,
    installLeadWeeks: 5,
    // Reported: one worker tends six automated machines.
    operatorsRequired: 0.17,
    operatorSkillLevel: 'semi_skilled',
    maintenanceHoursPerMonth: 4,
    // Reported: four to five times manual productivity; lower bound taken.
    throughputWorkersEquivalent: 4,
    notes:
      'Displaces single-operation stations rather than the whole sewing role — garment handling still ' +
      'resists automation. Reported alongside a warning that productivity gains did not reach worker ' +
      'incomes, which is the outcome this product exists to get ahead of.',
    sourceRef: AUTO,
    confidence: 'sourced',
    operations: [
      { code: 'sew-straight-seam', coverage: 90 },
      { code: 'sew-hem', coverage: 75 },
      { code: 'sew-attach-pocket', coverage: 60 },
    ],
    impact: [
      {
        roleSlug: 'sewing-machine-operator',
        displacedPerUnit: 4,
        createdPerUnit: 0.17,
        rationale:
          'One operator tends about six units, so the retained posts concentrate into a much smaller, ' +
          'higher-graded group. The displacement lands hardest on single-operation operators.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.1,
        rationale: 'Small per-unit servicing load that becomes material at scale.',
      },
    ],
  },

  {
    slug: 'template-sewing-jig',
    name: 'Template / jig-based sewing aid',
    category: 'sewing',
    automationLevel: 'assisted',
    capitalCostBdt: 120_000,
    installLeadWeeks: 2,
    operatorsRequired: 1,
    operatorSkillLevel: 'entry',
    maintenanceHoursPerMonth: 1,
    throughputWorkersEquivalent: 1.6,
    notes:
      'Standardises a previously skilled operation. The exposure is grade and wage erosion rather than ' +
      'displacement: the post survives, the skill premium attached to it does not.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'sew-attach-pocket', coverage: 70 }],
    impact: [
      {
        roleSlug: 'sewing-machine-operator',
        displacedPerUnit: 0.6,
        createdPerUnit: 0,
        rationale:
          'A jig raises one operator’s output rather than removing the operator, so displacement ' +
          'accrues gradually through reduced hiring rather than through separations.',
      },
    ],
  },

  {
    slug: 'laser-ozone-finishing-cell',
    name: 'Laser abrasion & ozone finishing cell',
    category: 'finishing',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 14_000_000,
    installLeadWeeks: 10,
    operatorsRequired: 2,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 16,
    throughputWorkersEquivalent: 34,
    healthSafetyNote:
      'Replaces manual sanding, scraping and potassium permanganate spraying — processes documented as ' +
      'damaging to worker health. Adoption is compliance- and buyer-driven, so it moves faster than a ' +
      'cost case alone would predict, and the transition window is correspondingly shorter.',
    notes:
      'Laser finishing has entirely replaced manual scraping where adopted, cutting the process from ' +
      'about 90 steps to 15. Reported adoption above 70% of denim manufacturers.',
    sourceRef: LASER,
    confidence: 'sourced',
    operations: [
      { code: 'wash-hand-sand', coverage: 100 },
      { code: 'wash-stone-cycle', coverage: 85 },
    ],
    impact: [
      {
        roleSlug: 'washing-plant-operator',
        displacedPerUnit: 34,
        createdPerUnit: 2,
        rationale:
          'The largest single displacement in the catalogue, and the one with the strongest case for ' +
          'making it happen anyway: the work being removed is hazardous. That makes the training ' +
          'schedule the whole argument, because the purchase will not be delayed for the workforce.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.4,
        rationale: 'Optical and gas systems need specialist servicing the existing team does not yet hold.',
      },
    ],
  },

  {
    slug: 'tunnel-finisher',
    name: 'Tunnel finisher',
    category: 'finishing',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 6_400_000,
    installLeadWeeks: 7,
    operatorsRequired: 3,
    operatorSkillLevel: 'semi_skilled',
    maintenanceHoursPerMonth: 10,
    throughputWorkersEquivalent: 48,
    notes:
      'Displaces bulk pressing but not garment-specific finishing judgement, so a meaningful share of ' +
      'the role survives in a changed form.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'press-bulk', coverage: 90 }],
    impact: [
      {
        roleSlug: 'finishing-ironing-staff',
        displacedPerUnit: 48,
        createdPerUnit: 3,
        rationale:
          'Bulk pressing goes; final inspection pressing and garment-specific finishing remain and are ' +
          'the natural redeployment target.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.25,
        rationale: 'Steam and conveyor systems add a recurring servicing load.',
      },
    ],
  },

  {
    slug: 'automated-packing-line',
    name: 'Automated carton packing line',
    category: 'handling',
    automationLevel: 'semi_automatic',
    capitalCostBdt: 5_200_000,
    installLeadWeeks: 9,
    operatorsRequired: 4,
    operatorSkillLevel: 'semi_skilled',
    maintenanceHoursPerMonth: 14,
    throughputWorkersEquivalent: 34,
    notes:
      'Automates in segments; mixed-SKU and irregular cartons stay manual, so exposure depends heavily ' +
      'on the line configuration purchased rather than on the category.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [
      { code: 'pack-carton', coverage: 80 },
      { code: 'pack-label-scan', coverage: 95 },
    ],
    impact: [
      {
        roleSlug: 'packing-staff',
        displacedPerUnit: 34,
        createdPerUnit: 4,
        rationale: 'Four line-tending posts replace the manual packing bench for standard cartons.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.3,
        rationale: 'Conveyor and strapping systems require regular servicing.',
      },
    ],
  },

  {
    slug: 'ai-defect-scanner',
    name: 'AI visual defect scanning gantry',
    category: 'inspection',
    automationLevel: 'semi_automatic',
    capitalCostBdt: 4_100_000,
    installLeadWeeks: 6,
    operatorsRequired: 1,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 6,
    throughputWorkersEquivalent: 17,
    notes:
      'Augments rather than replaces: exception handling, buyer-specific tolerance calls and rework ' +
      'decisions stay human. The role changes shape more than it shrinks.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'inspect-visual', coverage: 70 }],
    impact: [
      {
        roleSlug: 'quality-inspector',
        displacedPerUnit: 17,
        createdPerUnit: 1,
        rationale:
          'The scanner clears routine passes; inspectors move to exception handling, which needs fewer ' +
          'people but at a higher grade.',
      },
    ],
  },

  {
    slug: 'digital-dtg-printer',
    name: 'Digital direct-to-garment printer',
    category: 'printing',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 7_800_000,
    installLeadWeeks: 7,
    operatorsRequired: 1,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 12,
    throughputWorkersEquivalent: 15,
    notes:
      'Removes screen preparation and manual registration entirely. Short-run and multi-colour work ' +
      'moves first; long-run single-colour screen printing stays cost-competitive for longer.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [
      { code: 'print-screen-prep', coverage: 100 },
      { code: 'print-apply', coverage: 85 },
    ],
    impact: [
      {
        roleSlug: 'screen-printing-operator',
        displacedPerUnit: 15,
        createdPerUnit: 1,
        rationale: 'Colour management and file preparation become the retained skill.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.25,
        rationale: 'Print heads and ink systems need frequent specialist attention.',
      },
    ],
  },

  {
    slug: 'overhead-bundle-transport',
    name: 'Overhead bundle transport system',
    category: 'handling',
    automationLevel: 'semi_automatic',
    capitalCostBdt: 2_900_000,
    installLeadWeeks: 8,
    operatorsRequired: 0.5,
    operatorSkillLevel: 'entry',
    maintenanceHoursPerMonth: 9,
    throughputWorkersEquivalent: 36,
    notes:
      'Removes bundle carrying between stations, which is most of the helper role. Because helpers are ' +
      'the usual entry point into the factory, this also closes the main progression path into operator ' +
      'grades — a second-order effect worth planning for explicitly.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'move-bundles', coverage: 90 }],
    impact: [
      {
        roleSlug: 'helper-operator',
        displacedPerUnit: 36,
        createdPerUnit: 0.5,
        rationale:
          'The largest headcount effect per taka in the catalogue, landing on the lowest-paid and least ' +
          'formally skilled group. Progression into operator grades has to be replaced deliberately.',
      },
      {
        roleSlug: 'maintenance-technician',
        createdPerUnit: 0.2,
        rationale: 'Rail and carrier servicing.',
      },
    ],
  },

  {
    slug: 'rfid-warehouse-system',
    name: 'RFID stock tracking & warehouse management',
    category: 'systems',
    automationLevel: 'semi_automatic',
    capitalCostBdt: 3_600_000,
    installLeadWeeks: 12,
    operatorsRequired: 2,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 5,
    throughputWorkersEquivalent: 42,
    notes:
      'Removes manual counting and reconciliation. Physical goods handling and discrepancy ' +
      'investigation remain, so the role contracts rather than ends.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'stock-count', coverage: 95 }],
    impact: [
      {
        roleSlug: 'store-inventory-clerk',
        displacedPerUnit: 42,
        createdPerUnit: 2,
        rationale: 'Systems handling and exception investigation become the retained work.',
      },
    ],
  },

  {
    slug: 'multi-head-embroidery',
    name: 'Multi-head automated embroidery system',
    category: 'sewing',
    automationLevel: 'fully_automatic',
    capitalCostBdt: 2_400_000,
    installLeadWeeks: 5,
    operatorsRequired: 1,
    operatorSkillLevel: 'skilled',
    maintenanceHoursPerMonth: 7,
    throughputWorkersEquivalent: 9,
    notes:
      'The role is already machine-mediated, so additional automation raises heads per operator rather ' +
      'than eliminating the operator. Digitising and thread management stay skilled work.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'embroider-run', coverage: 85 }],
    impact: [
      {
        roleSlug: 'embroidery-machine-operator',
        displacedPerUnit: 9,
        createdPerUnit: 1,
        rationale: 'One operator supervises the head bank; digitising demand rises slightly.',
      },
    ],
  },

  {
    slug: 'cad-marker-system',
    name: 'CAD/CAM pattern & marker-making system',
    category: 'systems',
    automationLevel: 'assisted',
    capitalCostBdt: 1_800_000,
    installLeadWeeks: 4,
    operatorsRequired: 2,
    operatorSkillLevel: 'specialist',
    maintenanceHoursPerMonth: 2,
    throughputWorkersEquivalent: 6,
    notes:
      'Changes the tooling rather than removing the craft judgement. Exposure is concentrated in manual ' +
      'marker-making; the design skill transfers directly to the software.',
    sourceRef: EST,
    confidence: 'estimated',
    operations: [{ code: 'make-marker', coverage: 95 }],
    impact: [
      {
        roleSlug: 'fabric-pattern-cutter',
        displacedPerUnit: 6,
        createdPerUnit: 2,
        rationale:
          'The strongest retraining case in the catalogue: the existing skill maps almost directly onto ' +
          'the software, so the transition is a tooling change rather than a career change.',
      },
    ],
  },
];
