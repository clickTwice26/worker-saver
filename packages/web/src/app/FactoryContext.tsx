import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface FactoryValue {
  factoryId: number;
  setFactoryId: (id: number) => void;
  /** Bumped whenever inputs change or the analysis re-runs, to force refetches. */
  refreshKey: number;
  bumpRefresh: () => void;
}

const FactoryContext = createContext<FactoryValue | null>(null);

/**
 * Which factory the app is looking at.
 *
 * Held above the router outlet so switching factories or re-running the analysis
 * refreshes every page at once, rather than leaving one tab showing figures from
 * a roster the user has already moved on from.
 */
export function FactoryProvider({ children }: { children: ReactNode }) {
  const [factoryId, setFactoryId] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Changing factory is itself a refresh: the previous factory's plan must not
  // linger on screen while the new one loads.
  const selectFactory = useCallback((id: number) => {
    setFactoryId(id);
    setRefreshKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({ factoryId, setFactoryId: selectFactory, refreshKey, bumpRefresh }),
    [factoryId, selectFactory, refreshKey, bumpRefresh],
  );

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
}

export function useFactory(): FactoryValue {
  const value = useContext(FactoryContext);
  if (!value) throw new Error('useFactory must be used inside <FactoryProvider>');
  return value;
}
