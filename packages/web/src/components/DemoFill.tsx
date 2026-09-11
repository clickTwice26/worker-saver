import { Button, Tooltip } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

/**
 * True only under `vite dev`.
 *
 * Vite replaces `import.meta.env.DEV` with a literal at build time, so
 * `{DEV_TOOLS && <DemoFill … />}` collapses to nothing and the call site —
 * props, labels and handler — is removed from the bundle entirely. Guarding
 * only inside the component leaves its props behind, because they are built
 * before the component gets to return null.
 *
 * Gating at the call site matters more than tidiness: a button that merely
 * *looks* hidden is one config mistake away from putting invented numbers in
 * front of a factory manager, which is the one thing this product must not do.
 *
 * A deployed demo can opt in with `VITE_ALE_DEMO_TOOLS=1` at build time. That
 * is a deliberate act with an obvious name — unset, the comparison is against
 * `undefined` and the whole branch still tree-shakes away, so the safe default
 * is preserved for any build that does not ask for it.
 */
export const DEV_TOOLS = import.meta.env.DEV
  || import.meta.env.VITE_ALE_DEMO_TOOLS === '1';

/** A development-only shortcut that fills a form with plausible values. */
export function DemoFill({ onFill, label = 'Fill' }: { onFill: () => void; label?: string }) {
  if (!DEV_TOOLS) return null;

  return (
    <Tooltip title="Development only — fills this form with random plausible values">
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        startIcon={<AutoFixHighIcon />}
        onClick={onFill}
        sx={{ borderStyle: 'dashed' }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

// --- random helpers, shared by the fill handlers ---------------------------

export const randomInt = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

export const pickOne = <T,>(items: readonly T[]): T | undefined =>
  items.length === 0 ? undefined : items[Math.floor(Math.random() * items.length)];

/** An ISO date between `minMonths` and `maxMonths` from today. */
export const randomIsoDate = (minMonths: number, maxMonths: number): string => {
  const date = new Date();
  date.setMonth(date.getMonth() + randomInt(minMonths, maxMonths));
  date.setDate(randomInt(1, 28));
  return date.toISOString().slice(0, 10);
};
