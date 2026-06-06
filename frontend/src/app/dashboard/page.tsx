'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2, Scissors } from 'lucide-react';

export default function DashboardRootPage() {
  const router = useRouter();
  const { user, loading, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized && !loading) {
      if (!user) {
        router.push('/login');
      } else {
        // Redirecionamento baseado no cargo (RBAC)
        if (user.role === 'super_admin') {
          router.push('/dashboard/super-admin');
        } else if (user.role === 'owner' || user.role === 'manager') {
          router.push('/dashboard/admin');
        } else if (user.role === 'employee') {
          router.push('/dashboard/employee');
        } else {
          router.push('/booking');
        }
      }
    }
  }, [user, loading, initialized, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center animate-pulse border border-amber-400/20">
          <Scissors className="h-6 w-6 text-black stroke-[2]" />
        </div>
        <p className="text-sm text-gray-500 tracking-wider">Verificando credenciais...</p>
        <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
      </div>
    </div>
  );
}
