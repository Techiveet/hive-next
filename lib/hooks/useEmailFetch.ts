// hooks/useEmailFetch.ts

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function useEmailFetch(
  initialEmails: any[],
  folderName: string,
  pageSize: number,
  initialSearch: string,
  nextCursor: string | null
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emails, setEmails] = useState(initialEmails);
  const [cursor, setCursor] = useState(nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(!!nextCursor);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Fetch emails function
  const fetchEmails = useCallback(async (
    cursor: string | null,
    search: string,
    append: boolean = false
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('folder', folderName);
      params.set('pageSize', pageSize.toString());
      if (search.trim()) {
        params.set('q', search.trim());
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/emails?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        if (append) {
          setEmails(prev => [...prev, ...data.data.items]);
        } else {
          setEmails(data.data.items);
        }
        setCursor(data.data.nextCursor);
        setHasMore(data.data.hasNextPage);
        
        // Update URL without reloading the page
        const newParams = new URLSearchParams(searchParams.toString());
        if (cursor) {
          newParams.set('cursor', cursor);
        } else {
          newParams.delete('cursor');
        }
        
        // Update URL but don't trigger navigation
        const url = `/email?${newParams.toString()}`;
        window.history.replaceState(null, '', url);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, [folderName, pageSize, searchParams]);

  // Initial load
  useEffect(() => {
    setEmails(initialEmails);
    setCursor(nextCursor);
    setHasMore(!!nextCursor);
  }, [initialEmails, nextCursor]);

  // Load more emails (pagination)
  const loadMore = useCallback(() => {
    if (!cursor || loading) return;
    fetchEmails(cursor, searchQuery, true);
  }, [cursor, loading, fetchEmails, searchQuery]);

  // Load latest (go to first page)
  const loadLatest = useCallback(() => {
    fetchEmails(null, searchQuery, false);
  }, [fetchEmails, searchQuery]);

  // Search with debounce
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    
    const timeoutId = setTimeout(() => {
      fetchEmails(null, value, false);
    }, 400);
    
    return () => clearTimeout(timeoutId);
  }, [fetchEmails]);

  return {
    emails,
    loading,
    hasMore,
    searchQuery,
    cursor,
    loadMore,
    loadLatest,
    handleSearch,
    setEmails, // For optimistic updates
  };
}