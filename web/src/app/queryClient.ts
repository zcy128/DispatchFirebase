import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client for the Dispatch Console web application.
 */
export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
