import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Run an async loader and track its state.
 *
 * Guards against a resolved response from a superseded request overwriting a
 * newer one, which is what produces stale numbers on a dashboard after a reload.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => { if (active) setData(result); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
