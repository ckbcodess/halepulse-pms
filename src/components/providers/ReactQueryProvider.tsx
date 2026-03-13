'use client';

/**
 * ReactQueryProvider — wraps the app in a QueryClientProvider.
 *
 * Why this exists in a separate file:
 * - QueryClientProvider requires 'use client'
 * - layout.tsx is a Server Component — it cannot use hooks or context directly
 * - This pattern keeps the server component as the root while enabling
 *   client-side caching throughout the entire component tree.
 *
 * Default query options applied globally:
 * - staleTime: 5 min  — cached data is considered fresh for 5 minutes.
 *   Re-navigating to the same page within this window renders instantly.
 * - gcTime: 10 min    — unused cache entries are garbage collected after 10 min.
 * - retry: 1          — retry once on network error before showing error state.
 * - refetchOnWindowFocus: true — silently refresh when the browser tab regains focus.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures each browser session gets its own QueryClient instance.
  // Using a module-level singleton would cause data to leak between SSR requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:          5 * 60 * 1000, // 5 minutes
            gcTime:             10 * 60 * 1000, // 10 minutes
            retry:              1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
