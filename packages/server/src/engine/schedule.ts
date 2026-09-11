/**
 * Turns findings into a month-by-month training calendar.
 *
 * This is the output the specification did not produce and the reason a factory
 * comes back: "sewing operators are at 68%" is a fact, but "run 40 seats in
 * March, 40 in April, and you are covered before the units land" is a plan.
 */

import type { Finding, ScheduleEntry, ScheduleMonth } from '@ale/shared';
import { addMonths, monthKey } from '../lib/dates.ts';

/**
 * Build the calendar.
 *
 * Cohorts are laid out one intake per month from each finding's `startByDate`.
 * Where that date has already passed the intake is clamped to the current month
 * rather than drawn in the past — the deadline is still reported as missed via
 * `scheduleStatus`, but the calendar stays actionable.
 */
export function buildSchedule(findings: Finding[], asOfDate: string): ScheduleMonth[] {
  const months = new Map<string, ScheduleEntry[]>();

  for (const finding of findings) {
    const firstIntake = finding.startByDate < asOfDate ? asOfDate : finding.startByDate;
    let remaining = finding.workersAffected;

    for (let cohort = 0; cohort < finding.cohortsRequired; cohort += 1) {
      const seats = Math.min(finding.trainingSeatsPerMonth, remaining);
      if (seats <= 0) break;
      remaining -= seats;

      const key = monthKey(addMonths(firstIntake, cohort));
      const entry: ScheduleEntry = {
        findingId: finding.id,
        roleSlug: finding.roleSlug,
        roleLabel: finding.roleLabel,
        trainingProgramName: finding.trainingProgramName,
        seats,
        cohortIndex: cohort + 1,
        cohortsTotal: finding.cohortsRequired,
        machineName: finding.machineName,
        arrivalDate: finding.arrivalDate,
      };

      const bucket = months.get(key);
      if (bucket) bucket.push(entry);
      else months.set(key, [entry]);
    }
  }

  const costPerSeat = new Map(
    findings.map((f) => [f.id, f.workersAffected > 0 ? f.trainingCostPerSeatBdt : 0]),
  );

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entries]) => {
      const sorted = [...entries].sort(
        (a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || a.roleSlug.localeCompare(b.roleSlug),
      );
      return {
        month,
        entries: sorted,
        seatsThisMonth: sorted.reduce((sum, e) => sum + e.seats, 0),
        costThisMonthBdt: sorted.reduce(
          (sum, e) => sum + e.seats * (costPerSeat.get(e.findingId) ?? 0), 0,
        ),
      };
    });
}
