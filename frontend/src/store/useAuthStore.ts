import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'owner' | 'manager' | 'employee' | 'client';
  tenantId: string;
}

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session && session.user) {
      const metadata = session.user.user_metadata;
      set({
        session,
        user: {
          id: session.user.id,
          email: session.user.email || '',
          name: metadata.name || '',
          role: metadata.role || 'client',
          tenantId: metadata.tenantId || '',
        },
        loading: false,
        initialized: true,
      });
    } else {
      set({ session: null, user: null, loading: false, initialized: true });
    }

    // Escutar mudanças de estado de autenticação
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        const metadata = session.user.user_metadata;
        set({
          session,
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: metadata.name || '',
            role: metadata.role || 'client',
            tenantId: metadata.tenantId || '',
          },
          loading: false,
        });
      } else {
        set({ session: null, user: null, loading: false });
      }
    });
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, loading: false });
  },
}));
