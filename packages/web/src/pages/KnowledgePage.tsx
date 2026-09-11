import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import type { Department, RiskRule, Role } from '@ale/shared';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { t, formatNumber, formatCurrency } from '../copy/index.ts';
import type { CopyKey } from '../copy/strings.ts';
import {
  BandChip, ConfidenceChip, ErrorState, LoadingState, SectionHeading, SeverityRail,
} from '../components/Primitives.tsx';

const DEPARTMENTS: Department[] = ['cutting', 'sewing', 'finishing', 'support', 'technical'];

const DEPT_KEY: Record<Department, CopyKey> = {
  cutting: 'deptCutting',
  sewing: 'deptSewing',
  finishing: 'deptFinishing',
  support: 'deptSupport',
  technical: 'deptTechnical',
};

/**
 * The knowledge base, made inspectable.
 *
 * Every score is shown with the reasoning that produced it and the source it
 * rests on. This page exists because "the CSV said so" is not an answer when a
 * production manager asks why a role scored 74 — and because every row here is
 * currently an estimate, which the product states rather than hides.
 */
export function KnowledgePage() {
  const roles = useAsync(() => api.listRoles(), []);
  const rules = useAsync(() => api.listRiskRules(), []);
  const programs = useAsync(() => api.listTrainingPrograms(), []);

  if (roles.loading || rules.loading || programs.loading) return <LoadingState />;

  const error = roles.error ?? rules.error ?? programs.error;
  if (error) {
    return <ErrorState message={error} onRetry={() => { roles.reload(); rules.reload(); programs.reload(); }} />;
  }

  const roleById = new Map<number, Role>((roles.data ?? []).map((r) => [r.id, r]));
  const ruleList = rules.data ?? [];

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('knowledgeTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '72ch' }}>
        {t('knowledgeIntro')}
      </Typography>

      {DEPARTMENTS.map((department) => {
        const here = ruleList
          .filter((rule) => roleById.get(rule.roleId)?.department === department)
          .sort((a, b) => b.baseScore - a.baseScore);
        if (here.length === 0) return null;

        return (
          <Box key={department} sx={{ mb: 3 }}>
            <SectionHeading title={t(DEPT_KEY[department])} />
            <Card>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 180 }}>{t('role')}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>{t('machineTrigger')}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 110 }}>{t('riskScore')}</TableCell>
                      <TableCell>{t('why')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {here.map((rule) => (
                      <RuleRow key={rule.id} rule={rule} role={roleById.get(rule.roleId)} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>
        );
      })}

      <SectionHeading title={t('programs')} />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 210 }}>{t('training')}</TableCell>
                <TableCell>{t('role')}</TableCell>
                <TableCell align="right">{t('duration')}</TableCell>
                <TableCell align="right">{t('capacity')}</TableCell>
                <TableCell align="right">{t('perSeat')}</TableCell>
                <TableCell>{t('provider')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(programs.data ?? []).map((program) => (
                <TableRow key={program.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{program.name}</Typography></TableCell>
                  <TableCell>{roleById.get(program.targetRoleId)?.label ?? '—'}</TableCell>
                  <TableCell align="right">{formatNumber(program.durationWeeks)} {t('weeks')}</TableCell>
                  <TableCell align="right">{formatNumber(program.seatsPerMonth)}</TableCell>
                  <TableCell align="right">{formatCurrency(program.costPerSeatBdt)}</TableCell>
                  <TableCell>{program.provider}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}

function RuleRow({ rule, role }: { rule: RiskRule; role: Role | undefined }) {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          <SeverityRail band={rule.band} />{role?.label ?? rule.roleSlug}
        </Typography>
      </TableCell>
      <TableCell><Typography variant="body2">{rule.machineTrigger}</Typography></TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(rule.baseScore)}
        </Typography>
        <Box sx={{ mt: 0.5 }}><BandChip band={rule.band} /></Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '66ch' }}>{rule.rationale}</Typography>
        <Box sx={{ mt: 0.75, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
            {t('source')}: {rule.sourceRef}
          </Typography>
          <ConfidenceChip confidence={rule.confidence} />
        </Box>
      </TableCell>
    </TableRow>
  );
}
