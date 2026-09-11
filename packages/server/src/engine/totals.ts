import type { Finding, PlanTotals, RoleHeadcount } from '@ale/shared';

/**
 * Headline figures for the plan.
 *
 * `workersAffected` is capped at each role's headcount before summing: two
 * machines hitting the same role must not be able to report more people
 * affected than the factory employs.
 */
export function computeTotals(
  findings: Finding[],
  headcounts: RoleHeadcount[],
  weightedRiskScore: number,
): PlanTotals {
  const affectedByRole = new Map<number, number>();
  const headcountByRole = new Map(headcounts.map((h) => [h.roleId, h.headcount]));

  for (const finding of findings) {
    affectedByRole.set(
      finding.roleId,
      (affectedByRole.get(finding.roleId) ?? 0) + finding.workersAffected,
    );
  }

  let workersAffected = 0;
  for (const [roleId, affected] of affectedByRole) {
    workersAffected += Math.min(affected, headcountByRole.get(roleId) ?? affected);
  }

  const arrivals = findings.map((f) => f.arrivalDate).sort();

  const workersCreated = findings.reduce((sum, f) => sum + f.workersCreated, 0);

  return {
    workforceModelled: headcounts.reduce((sum, h) => sum + h.headcount, 0),
    rolesTracked: headcounts.length,
    workersAffected,
    rolesAtHighRisk: new Set(
      findings.filter((f) => f.riskBand === 'high').map((f) => f.roleId),
    ).size,
    totalCostBdt: findings.reduce((sum, f) => sum + f.estimatedCostBdt, 0),
    totalSeats: findings.reduce((sum, f) => sum + f.workersAffected, 0),
    overdueCount: findings.filter((f) => f.scheduleStatus === 'overdue').length,
    weightedRiskScore,
    earliestArrival: arrivals[0] ?? null,
    workersCreated,
    // Negative means the workforce shrinks. Reported rather than buried, because
    // it is the figure a factory is least likely to have worked out itself.
    netWorkforceChange: workersCreated - workersAffected,
    totalCapitalCostBdt: findings.reduce((sum, f) => sum + f.capitalCostBdt, 0),
    monthlyLabourSavingBdt: findings.reduce((sum, f) => sum + f.monthlyLabourSavingBdt, 0),
    healthSafetyCount: findings.filter((f) => f.healthSafetyNote !== null).length,
  };
}
