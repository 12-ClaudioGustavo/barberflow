'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute cache
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
