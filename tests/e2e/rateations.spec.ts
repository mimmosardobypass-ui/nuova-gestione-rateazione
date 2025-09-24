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
  
  test('displays N.36 with correct amounts (deterministic)', async ({ page }) => {
    // Mock deterministic response with canonical N.36 case (id 57)
    await page.route(/\/rest\/v1\/v_rateations_list_ui.*/i, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 57,
            owner_uid: 'test-user',
            number: '36',
            tipo: 'PagoPA',
            taxpayer_name: 'ACME Srl',
            status: 'ATTIVA',
            is_pagopa: true,
            total_amount_cents: 1817457,    // € 18.174,57
            paid_amount_cents: 32293,       // € 322,93
            residual_effective_cents: 1785164, // € 17.851,64
            overdue_effective_cents: 0,
            installments_total: 84,
            installments_paid: 1,
            installments_overdue_today: 0
          }
        ])
      });
    });

    await page.goto('/rateazioni');
    await page.waitForLoadState('networkidle');

    // Verify exact amounts for N.36 (non-breaking space in currency formatting)
    await expect(page.getByText('€ 322,93')).toBeVisible();
    await expect(page.getByText('€ 17.851,64')).toBeVisible();
    await expect(page.getByText('N.36')).toBeVisible();
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