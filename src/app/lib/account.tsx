/** Who is signed in, shared across pages. Guests can always play practice. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Bootstrap } from '../../shared/competition/api';
import { api } from './api';

interface AccountState {
  bootstrap: Bootstrap | null;
  /** Server clock minus local clock (ms), for display-only countdowns. */
  clockOffset: number;
  loading: boolean;
  offline: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now();
      const b = await api.bootstrap();
      setClockOffset(b.serverNow - (t0 + Date.now()) / 2);
      setBootstrap(b);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ bootstrap, clockOffset, loading, offline, refresh, signOut }), [bootstrap, clockOffset, loading, offline, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount(): AccountState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount outside AccountProvider');
  return v;
}
