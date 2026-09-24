import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { config } from '../lib/config';
import { getSupabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      signedIn: config.devBypassAuth || session !== null,
      async signIn(email, password) {
        const supabase = getSupabase();
        if (!supabase) return 'Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? 'El email o la contraseña no coinciden. Probá de nuevo.' : null;
      },
      async signOut() {
        await getSupabase()?.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
