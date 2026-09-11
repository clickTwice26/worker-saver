/**
 * The risk knowledge base.
 *
 * PROVENANCE — read this before quoting any number downstream.
 *
 * Every row in this file is marked `estimated`. The eight anchor scores
 * reproduce the role-level figures published in the ALE Insight dashboard
 * concept, which is explicitly labelled demo data for prototype purposes; the
 * remaining rows are reasoned extensions in the same style. None of them are
 * measurements taken from a factory floor, and the interface displays that
 * marking beside the number rather than burying it in a footnote.
 *
 * `rationale` states the reasoning behind each band so the score can be
 * discussed rather than merely asserted. The derivation follows four factors:
 * task specifiability, machine capability overlap, retraining difficulty, and
 * labour substitutability.
 *
 * Where a role has several rules the engine plans against the most exposed one,
 * so a secondary trigger documents a lesser scenario without changing the plan.
 *
 * Phase 0 of the build plan replaces these `sourceRef` values with primary
 * citations and promotes rows to `sourced` as that evidence lands.
 */

import type { Confidence, RiskBand } from '@ale/shared';

export interface RiskRuleSeed {
  roleSlug: string;
  machineTrigger: string;
  baseScore: number;
  band: RiskBand;
  rationale: string;
  sourceRef: string;
  confidence: Confidence;
}

/** The eight roles carried over from the dashboard concept. */
const ANCHOR = 'ALE Insight dashboard concept, demo dataset (moderate automation pace)';
/** Roles the concept did not track; reasoned in the same style. */
const EXTENDED = 'ALE Insight knowledge base v1, reasoned estimate pending primary sourcing';

export const riskRules: RiskRuleSeed[] = [
  // ---- anchor roles -------------------------------------------------------
  {
    roleSlug: 'cutting-machine-operator',
    machineTrigger: 'Automated / laser cutting machines',
    baseScore: 74,
    band: 'high',
    rationale:
      'Cutting is a fully specifiable geometric task and machine capability overlap is near total. ' +
      'Retraining difficulty is low, however: the supervision role sits close to the existing skill set, ' +
      'so the transition path is short where it is planned ahead of the arrival.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'cutting-machine-operator',
    machineTrigger: 'Computer-guided straight knife assistance',
    baseScore: 38,
    band: 'moderate',
    rationale:
      'Guided assistance raises throughput per operator without removing the operator. Exposure comes ' +
      'from reduced headcount per line rather than from the role disappearing.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'sewing-machine-operator',
    machineTrigger: 'Automated sewing units and semi-automated line equipment',
    baseScore: 68,
    band: 'high',
    rationale:
      'Individual seam operations automate readily, but garment handling still resists full automation, ' +
      'so displacement concentrates on single-operation stations rather than the whole role. ' +
      'Largest headcount in the workforce, which makes this the dominant planning constraint.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'sewing-machine-operator',
    machineTrigger: 'Template and jig-based sewing aids',
    baseScore: 45,
    band: 'moderate',
    rationale:
      'Jigs standardise a previously skilled operation, which compresses the skill premium more than it ' +
      'removes positions. The risk is wage and grade erosion rather than displacement.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'packing-staff',
    machineTrigger: 'Automated packing and carton-handling lines',
    baseScore: 55,
    band: 'moderate',
    rationale:
      'Packing automates in segments rather than wholesale; mixed-SKU and irregular-carton work remains ' +
      'manual. Exposure depends heavily on the specific line configuration purchased.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'finishing-ironing-staff',
    machineTrigger: 'Automated pressing and finishing equipment',
    baseScore: 41,
    band: 'moderate',
    rationale:
      'Tunnel finishers displace bulk pressing but not garment-specific finishing judgement. ' +
      'Displacement is gradual and predictable, which makes a phased transition realistic.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'fabric-pattern-cutter',
    machineTrigger: 'CAD/CAM pattern and marker-making systems',
    baseScore: 30,
    band: 'moderate',
    rationale:
      'Digital pattern systems change the tooling rather than remove the craft judgement. Exposure is ' +
      'concentrated in manual marker-making; the design skill transfers directly to the software.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'quality-inspector',
    machineTrigger: 'AI-assisted visual defect detection',
    baseScore: 22,
    band: 'low',
    rationale:
      'Machine vision augments inspection rather than replacing it — exception handling, buyer-specific ' +
      'tolerance calls and rework decisions stay human. The role changes shape more than it shrinks.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'line-supervisor',
    machineTrigger: 'Production monitoring and line-balancing dashboards',
    baseScore: 15,
    band: 'low',
    rationale:
      'Automation increases the coordination load rather than reducing it. Demand for the role is stable; ' +
      'the required skills shift toward reading and acting on line data.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },
  {
    roleSlug: 'maintenance-technician',
    machineTrigger: 'Robotics and automated equipment servicing',
    baseScore: 8,
    band: 'low',
    rationale:
      'Demand rises with automation rather than falling. The risk here is a skills gap, not displacement: ' +
      'servicing automated equipment requires training the existing team does not yet hold.',
    sourceRef: ANCHOR,
    confidence: 'estimated',
  },

  // ---- extended roles -----------------------------------------------------
  {
    roleSlug: 'fabric-spreader',
    machineTrigger: 'Automatic spreading machines',
    baseScore: 71,
    band: 'high',
    rationale:
      'Spreading is repetitive, highly specifiable and already the most commonly automated step in the ' +
      'cutting room. One machine replaces most of a manual spreading table, and the residual role is ' +
      'loading and supervision.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'washing-plant-operator',
    machineTrigger: 'Laser and ozone dry-finishing systems',
    baseScore: 66,
    band: 'high',
    rationale:
      'Laser abrasion and ozone finishing replace manual scraping and hand-sanding outright, and are ' +
      'adopted for water and chemical compliance rather than labour cost — which makes the transition ' +
      'buyer-driven and fast once it starts.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'screen-printing-operator',
    machineTrigger: 'Digital direct-to-garment printing',
    baseScore: 63,
    band: 'high',
    rationale:
      'Digital printing removes screen preparation and manual registration entirely. Short-run and ' +
      'multi-colour work moves first; long-run single-colour screen printing remains cost-competitive ' +
      'for longer.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'store-inventory-clerk',
    machineTrigger: 'RFID stock tracking and warehouse management systems',
    baseScore: 52,
    band: 'moderate',
    rationale:
      'RFID removes manual counting and reconciliation, which is most of the clerical workload. ' +
      'Physical goods handling and discrepancy investigation remain, so the role contracts rather than ' +
      'ends.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'helper-operator',
    machineTrigger: 'Automated material handling and overhead transport',
    baseScore: 49,
    band: 'moderate',
    rationale:
      'Overhead transport systems remove bundle carrying between stations, which is the bulk of the ' +
      'helper role. Because helpers are the usual entry point into the factory, displacement here also ' +
      'closes the main progression path into operator grades — worth planning for explicitly.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'embroidery-machine-operator',
    machineTrigger: 'Multi-head automated embroidery systems',
    baseScore: 44,
    band: 'moderate',
    rationale:
      'The role is already machine-mediated, so additional automation raises heads per operator rather ' +
      'than eliminating the operator. Digitising and thread management remain skilled work.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'merchandiser',
    machineTrigger: 'AI-assisted order management and costing',
    baseScore: 18,
    band: 'low',
    rationale:
      'Costing and scheduling automate; buyer relationship management, negotiation and problem escalation ' +
      'do not. Tooling shifts the work upward rather than removing it.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
  {
    roleSlug: 'industrial-engineer',
    machineTrigger: 'Automated line balancing and time study',
    baseScore: 12,
    band: 'low',
    rationale:
      'Automation generates the data this role exists to interpret, so demand rises. The gap is analytical ' +
      'tooling skill rather than job security.',
    sourceRef: EXTENDED,
    confidence: 'estimated',
  },
];
