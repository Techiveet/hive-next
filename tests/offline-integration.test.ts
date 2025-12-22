// tests/offline-integration.test.ts

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

// Or if using Vitest:
// import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock the offline functionality
describe('Offline Integration Tests', () => {
  let originalFetch: typeof fetch;
  
  beforeAll(() => {
    originalFetch = global.fetch;
  });
  
  afterAll(() => {
    global.fetch = originalFetch;
  });
  
  it('should queue requests when offline', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true
    });
    
    // Mock fetch to simulate offline behavior
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
    // Import the offlineFetch function
    const { offlineFetch } = await import('@/lib/offline/offline-api');
    
    const response = await offlineFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    });
    
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.queued).toBe(true);
  });
  
  it('should send requests directly when online', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true
    });
    
    const mockResponse = { success: true, data: 'test' };
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
    const { offlineFetch } = await import('@/lib/offline/offline-api');
    
    const response = await offlineFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});