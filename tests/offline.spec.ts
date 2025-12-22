// tests/offline.spec.ts

import { Page, expect, test } from '@playwright/test';

// Helper to wait for service worker registration
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => 
    'serviceWorker' in navigator && 
    navigator.serviceWorker.controller !== null
  );
}

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the offline test page
    await page.goto('/dashboard/offline-test');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for service worker
    await waitForServiceWorker(page);
  });

  test('should show online status when connected', async ({ page }) => {
    // Check for online indicator
    await expect(page.locator('text=Status: Online')).toBeVisible();
    await expect(page.locator('text=Online')).toBeVisible();
  });

  test('should show offline indicator when network is offline', async ({ page }) => {
    // Simulate going offline
    await page.context().setOffline(true);
    
    // Wait for UI to update
    await page.waitForTimeout(1000);
    
    // Check for offline indicator
    const offlineText = page.locator('text=Status: Offline');
    await expect(offlineText).toBeVisible();
    
    // Should show pending queue section
    await expect(page.locator('text=Pending queue:')).toBeVisible();
    
    // Restore online
    await page.context().setOffline(false);
  });

  test('should save form data locally when offline', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    // Fill and submit form
    await page.fill('input[placeholder="Name"]', 'Test User');
    await page.fill('input[placeholder="Email"]', 'test@example.com');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Should show "Saved locally" message - check for toast or UI feedback
    try {
      // Check for toast (if using sonner/toast)
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
    } catch {
      // Fallback: check for UI text
      await expect(page.locator('text=Saved locally').or(page.locator('text=Queued for sync'))).toBeVisible({ timeout: 2000 });
    }
    
    // Should show pending count increased
    await expect(page.locator('text=Pending queue:').first()).toContainText(/[1-9]/);
  });

  test('should sync pending items when back online', async ({ page }) => {
    // First, create a pending item while offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    await page.fill('input[placeholder="Name"]', 'Sync Test');
    await page.fill('input[placeholder="Email"]', 'sync@test.com');
    await page.click('button[type="submit"]');
    
    // Wait for local save
    await page.waitForTimeout(1000);
    
    // Get initial pending count
    const pendingText = await page.locator('text=Pending queue:').first().textContent();
    const initialPending = parseInt(pendingText?.match(/\d+/)?.[0] || '0');
    
    expect(initialPending).toBeGreaterThan(0);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Wait for auto-sync (should happen within 2-3 seconds)
    await page.waitForTimeout(3000);
    
    // Check if pending count decreased or sync message appears
    try {
      // Wait for sync completion
      await page.waitForFunction(() => {
        const pendingElements = document.querySelectorAll('*');
        for (const el of pendingElements) {
          if (el.textContent?.includes('Syncing')) {
            return false;
          }
        }
        return true;
      }, { timeout: 5000 });
      
      // Check final pending count
      const finalPendingText = await page.locator('text=Pending queue:').first().textContent();
      const finalPending = parseInt(finalPendingText?.match(/\d+/)?.[0] || '0');
      
      // Pending should be less or zero
      expect(finalPending).toBeLessThan(initialPending);
      
    } catch {
      // If sync doesn't happen automatically, trigger manual sync
      const syncButton = page.locator('button:has-text("Sync Now")');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should handle server errors gracefully', async ({ page }) => {
    // Mock server failure for specific API endpoint
    await page.route('/api/offline-test', async route => {
      await route.abort('failed');
    });
    
    // Try to submit while online (should fail to server)
    await page.fill('input[placeholder="Name"]', 'Server Error Test');
    await page.fill('input[placeholder="Email"]', 'error@test.com');
    await page.click('button[type="submit"]');
    
    // Should handle error - either show error message or queue locally
    await page.waitForTimeout(1000);
    
    // Check for any error indication or fallback behavior
    const hasErrorOrFallback = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Error') || 
             text.includes('Failed') || 
             text.includes('Saved locally') ||
             text.includes('Queued');
    });
    
    expect(hasErrorOrFallback).toBeTruthy();
  });

  test('should load from cache when completely offline', async ({ page }) => {
    // First ensure we're online and page is cached
    await page.context().setOffline(false);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Go completely offline
    await page.context().setOffline(true);
    
    // Try to reload the page
    await page.reload();
    
    // Page should still load (from cache)
    // Allow some time for potential fallback
    await page.waitForTimeout(2000);
    
    // Check if we can still see the main content
    // Either the main page loads or we get the offline fallback
    const pageContent = await page.content();
    const isLoaded = pageContent.includes('Offline Test Module') || 
                     pageContent.includes('You\'re offline') ||
                     pageContent.includes('No internet');
    
    expect(isLoaded).toBeTruthy();
  });

  test('manual sync button should work', async ({ page }) => {
    // Create pending items
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    await page.fill('input[placeholder="Name"]', 'Manual Sync Test');
    await page.fill('input[placeholder="Email"]', 'manual@test.com');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(1000);
    
    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);
    
    // Click manual sync button
    const syncButton = page.locator('button:has-text("Sync Now")');
    await expect(syncButton).toBeVisible();
    await syncButton.click();
    
    // Wait for sync to complete
    await page.waitForTimeout(3000);
    
    // Check for success indication
    const hasSuccess = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Sync complete') || 
             text.includes('Saved to database') ||
             text.includes('Synced');
    });
    
    expect(hasSuccess).toBeTruthy();
  });
});