import { useState } from 'react';
import {
  Alert, Box, Button, Card, IconButton, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, Chip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { MachineryPlan, MachineType, Role, RoleHeadcount } from '@ale/shared';
import { DATE_FORMAT, isoToPicker, pickerToIso } from '../lib/dates.ts';
import { api, ApiRequestError } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useApp } from '../app/AppLayout.tsx';
import { t, formatNumber, formatDate, formatCurrency } from '../copy/index.ts';
import { ErrorState, LoadingState, Panel, SectionHeading } from '../components/Primitives.tsx';
import { DemoFill, DEV_TOOLS, pickOne, randomInt, randomIsoDate } from '../components/DemoFill.tsx';

/**
 * Factory inputs.
 *
 * The roster is entered by role, not by worker — a handful of rows against the
 * 3,470 the original specification would have required, for output of the same
 * resolution. Worker-level records belong to phase 4.
 */
export function SetupPage() {
  const { factory, refreshKey, bumpRefresh } = useApp();
  const factoryId = factory.id;

  const roles = useAsync(() => api.listRoles(), [factoryId, refreshKey]);
  const headcounts = useAsync(() => api.listHeadcounts(factoryId), [factoryId, refreshKey]);
  const plans = useAsync(() => api.listMachineryPlans(factoryId), [factoryId, refreshKey]);
  const machines = useAsync(() => api.listMachineTypes(), []);

  if (roles.loading || headcounts.loading || plans.loading || machines.loading) return <LoadingState />;

  const error = roles.error ?? headcounts.error ?? plans.error ?? machines.error;
  if (error) return <ErrorState message={error} onRetry={() => { roles.reload(); headcounts.reload(); plans.reload(); }} />;

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>{t('setupTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {factory.name} · {factory.location}
      </Typography>

      <Alert severity="info" variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>{t('setupIntro')}</Alert>

      <Box sx={{ mb: 3 }}>
        <SectionHeading title={t('rosterTitle')} hint={t('rosterHint')} />
        <Card>
          <Roster
            factoryId={factoryId}
            roles={roles.data ?? []}
            headcounts={headcounts.data ?? []}
            onSaved={() => { headcounts.reload(); bumpRefresh(); }}
          />
        </Card>
      </Box>

      <SectionHeading title={t('machineryTitle')} hint={t('machineryHint')} />
      {(plans.data ?? []).length > 0 ? (
        <Card sx={{ mb: 2 }}>
          <MachineryTable
            factoryId={factoryId}
            plans={plans.data ?? []}
            onChanged={() => { plans.reload(); bumpRefresh(); }}
          />
        </Card>
      ) : null}
      <MachineryForm
        factoryId={factoryId}
        machines={machines.data ?? []}
        onAdded={() => { plans.reload(); bumpRefresh(); }}
      />
    </>
  );
}

/** Rough share of a floor by role, used only by the development fill. */
const DEMO_ROLE_SCALE: Record<string, [number, number]> = {
  'sewing-machine-operator': [900, 2400],
  'helper-operator': [400, 1100],
  'finishing-ironing-staff': [200, 700],
  'packing-staff': [150, 600],
  'quality-inspector': [120, 420],
  'cutting-machine-operator': [90, 320],
  'line-supervisor': [60, 260],
  'maintenance-technician': [40, 160],
};

function Roster({ factoryId, roles, headcounts, onSaved }: {
  factoryId: number; roles: Role[]; headcounts: RoleHeadcount[]; onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fillingAll, setFillingAll] = useState(false);

  const byRole = new Map(headcounts.map((h) => [h.roleId, h.headcount]));

  /**
   * Fill and save every role in one pass.
   *
   * Saving as well as filling, because a roster of unsaved drafts is not a
   * usable starting point for the analysis.
   */
  const fillAll = async () => {
    setFillingAll(true);
    setError(null);
    try {
      for (const role of roles) {
        const [lo, hi] = DEMO_ROLE_SCALE[role.slug] ?? [10, 120];
        await api.saveHeadcount(factoryId, { roleId: role.id, headcount: randomInt(lo, hi) });
      }
      setDrafts({});
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setFillingAll(false);
    }
  };

  const save = async (roleId: number) => {
    const raw = drafts[roleId];
    if (raw === undefined) return;
    const headcount = Number(raw);
    if (!Number.isInteger(headcount) || headcount < 0) {
      setError('Headcount must be a whole number of workers, zero or more.');
      return;
    }
    setSaving(roleId);
    setError(null);
    try {
      await api.saveHeadcount(factoryId, { roleId, headcount });
      setDrafts((d) => { const next = { ...d }; delete next[roleId]; return next; });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {error ? <Alert severity="error" sx={{ m: 2 }}>{error}</Alert> : null}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('role')}</TableCell>
              <TableCell align="right" sx={{ width: 170 }}>{t('workers')}</TableCell>
              <TableCell sx={{ width: 64 }} align="right">
                {DEV_TOOLS ? (
                  <DemoFill onFill={() => void fillAll()} label={fillingAll ? '…' : 'Fill all'} />
                ) : null}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => {
              const current = byRole.get(role.id) ?? 0;
              const draft = drafts[role.id];
              const dirty = draft !== undefined && Number(draft) !== current;
              return (
                <TableRow key={role.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{role.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {role.slug}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft ?? String(current)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [role.id]: e.target.value }))}
                      slotProps={{ htmlInput: { min: 0, style: { textAlign: 'right' }, 'aria-label': `${role.label} — ${t('workers')}` } }}
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('save')}>
                      <span>
                        <IconButton
                          color="primary"
                          disabled={!dirty || saving === role.id}
                          onClick={() => void save(role.id)}
                          aria-label={`${t('save')} ${role.label}`}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function MachineryTable({ factoryId, plans, onChanged }: {
  factoryId: number; plans: MachineryPlan[]; onChanged: () => void;
}) {
  const remove = async (planId: number) => {
    await api.removeMachineryPlan(factoryId, planId);
    onChanged();
  };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 200 }}>{t('machineName')}</TableCell>
            <TableCell>{t('affectedRole')}</TableCell>
            <TableCell>{t('arrivalDate')}</TableCell>
            <TableCell align="right">{t('units')}</TableCell>
            <TableCell>{t('displaces')}</TableCell>
            <TableCell sx={{ width: 64 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{plan.machineName}</Typography>
                {plan.machineTypeSlug ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
                    {plan.machineTypeSlug}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: 'Roboto Mono, monospace' }}>{plan.affectedRoleSlug}</Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(plan.arrivalDate)}</TableCell>
              <TableCell align="right">{formatNumber(plan.units)}</TableCell>
              <TableCell>
                {plan.headcountDisplacedPerUnit === null ? (
                  <Chip size="small" variant="outlined" label={t('derivedNote')} />
                ) : (
                  <>
                    {formatNumber(plan.headcountDisplacedPerUnit)}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t('overriddenNote')}
                    </Typography>
                  </>
                )}
              </TableCell>
              <TableCell>
                <Tooltip title={t('remove')}>
                  <IconButton
                    color="error"
                    onClick={() => void remove(plan.id)}
                    aria-label={`${t('remove')} ${plan.machineName}`}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Adding an arrival.
 *
 * The role and the displacement figure follow from the machine rather than
 * being separate questions, and the consequence is previewed before commit.
 */
function MachineryForm({ factoryId, machines, onAdded }: {
  factoryId: number; machines: MachineType[]; onAdded: () => void;
}) {
  const [machineSlug, setMachineSlug] = useState('');
  const [machineName, setMachineName] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [units, setUnits] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = machines.find((m) => m.slug === machineSlug);
  const primaryImpact = selected?.impact.slice().sort((a, b) => b.displacedPerUnit - a.displacedPerUnit)[0];
  const unitCount = Number(units) || 1;

  /** Pick a real catalogue machine and a plausible future arrival. */
  const fillDemo = () => {
    const machine = pickOne(machines);
    if (!machine) return;
    setMachineSlug(machine.slug);
    setMachineName('');
    setArrivalDate(randomIsoDate(2, 24));
    setUnits(String(randomInt(1, 8)));
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!selected || !primaryImpact || !arrivalDate) {
      setError('Choose a machine from the catalogue and give an arrival date.');
      return;
    }
    setBusy(true);
    try {
      await api.addMachineryPlan(factoryId, {
        machineName: machineName.trim() || selected.name,
        machineType: selected.slug,
        roleId: primaryImpact.roleId,
        arrivalDate,
        units: unitCount,
      });
      setMachineSlug(''); setMachineName(''); setArrivalDate(''); setUnits('1');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={t('add')} action={DEV_TOOLS ? <DemoFill onFill={fillDemo} /> : undefined}>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1.4fr 1fr 0.6fr auto' }, alignItems: 'start' }}>
        <TextField select size="small" label={t('machine')} value={machineSlug} onChange={(e) => setMachineSlug(e.target.value)}>
          <MenuItem value="">—</MenuItem>
          {machines.map((m) => <MenuItem key={m.slug} value={m.slug}>{m.name}</MenuItem>)}
        </TextField>
        <TextField
          size="small"
          label={t('machineName')}
          value={machineName}
          placeholder={selected?.name ?? ''}
          onChange={(e) => setMachineName(e.target.value)}
        />
        <DatePicker
          label={t('arrivalDate')}
          format={DATE_FORMAT}
          value={isoToPicker(arrivalDate)}
          onChange={(value) => setArrivalDate(pickerToIso(value))}
          slotProps={{
            textField: {
              size: 'small',
              // The engine works in whole days from this date, so a typo here
              // moves a training deadline. Say so at the field.
              helperText: t('arrivalDateHint'),
            },
          }}
        />
        <TextField
          size="small"
          type="number"
          label={t('units')}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          slotProps={{ htmlInput: { min: 1 } }}
        />
        <Button variant="contained" startIcon={<AddIcon />} disabled={busy || !selected} onClick={() => void submit()}>
          {t('add')}
        </Button>
      </Box>

      {selected && primaryImpact ? (
        <Alert severity="info" variant="outlined" sx={{ mt: 2, borderRadius: 3 }}>
          <Typography variant="body2">
            <strong>{primaryImpact.roleLabel}</strong> — {t('displaces')}{' '}
            {formatNumber(Math.round(primaryImpact.displacedPerUnit * unitCount))}, {t('creates').toLowerCase()}{' '}
            {formatNumber(Math.round(primaryImpact.createdPerUnit * unitCount))} · {t('capitalCost')}{' '}
            {formatCurrency(selected.capitalCostBdt * unitCount)} · {t('installLead')}{' '}
            {formatNumber(selected.installLeadWeeks)} {t('weeks')}
          </Typography>
          <Typography variant="caption" color="text.secondary">{primaryImpact.rationale}</Typography>
        </Alert>
      ) : null}
    </Panel>
  );
}
