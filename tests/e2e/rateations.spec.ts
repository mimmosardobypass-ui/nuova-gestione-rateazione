import { test, expect } from '@playwright/test';

test.describe('Rateations Page', () => {
  test('displays rateations list without validation errors', async ({ page }) => {
    // Navigate to rateations page
    await page.goto('/rateazioni');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check that no health warning banner is visible (data consistency)
    const healthBanner = page.locator('[data-testid="health-banner"]');
    await expect(healthBanner).not.toBeVisible();
    
    // Check that KPI cards are displayed
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    await expect(kpiCards.first()).toBeVisible();
    
    // Ensure no console errors related to data validation
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('validation')) {
        logs.push(msg.text());
      }
    });
    
    // Trigger data load
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    expect(logs).toHaveLength(0);
  });
  
  test('handles data validation gracefully', async ({ page }) => {
    // Mock invalid data response
    await page.route('/rest/v1/v_rateations_list_ui*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 999,
          invalid_field: 'should_fail_validation'
        }])
      });
    });
    
    await page.goto('/rateazioni');
    await page.waitForLoadState('networkidle');
    
    // Should not crash, should show fallback or empty state
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    const emptyState = page.locator('[data-testid="empty-rateations"]');
    
    // Either error boundary or empty state should be visible
    const hasErrorHandling = await errorBoundary.isVisible() || await emptyState.isVisible();
    expect(hasErrorHandling).toBe(true);
  });
});