// hooks/use-emails.ts

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useEmails(folder: string, pageSize: number = 10, initialData?: any) {
  // Get key for infinite loading
  const getKey = (pageIndex: number, previousPageData: any) => {
    // Reached the end
    if (previousPageData && !previousPageData.data.hasNextPage) return null;
    
    const params = new URLSearchParams({
      folder,
      pageSize: pageSize.toString(),
    });
    
    // Add cursor for pages after the first
    if (pageIndex > 0 && previousPageData?.data?.nextCursor) {
      params.set('cursor', previousPageData.data.nextCursor);
    }
    
    return `/api/emails?${params.toString()}`;
  };

  const { data, error, size, setSize, mutate, isValidating } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000, // 10 seconds
      fallbackData: initialData ? [initialData] : undefined,
    }
  );

  // Flatten emails from all pages
  const emails = data 
    ? data.flatMap(page => 
        page.data?.items?.map((item: any) => ({
          ...item,
          // Process here if needed
        })) || []
      )
    : [];

  const isLoading = !data && !error;
  const isLoadingMore = isValidating && size > 0;
  const isEmpty = data?.[0]?.data?.items?.length === 0;
  const isReachingEnd = data && data[data.length - 1]?.data?.hasNextPage === false;
  const isRefreshing = isValidating && data && data.length === size;

  return {
    emails,
    isLoading,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    isRefreshing,
    error,
    size,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}