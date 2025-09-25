import { test, expect } from '@playwright/test';

// Helper per aprire la pagina e il dialog
async function openMigrationDialog(page) {
  await page.goto('/rateazioni');
  // Apri il dialog della rateazione N.34 (adatta il trigger se diverso)
  await page.getByRole('button', { name: /gestisci migrazione/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('Selezione RQ mostra solo piani non collegati (RPC ok, poi fallback)', async ({ page }) => {
  // Mock RPC risposta: 1 sola RQ selezionabile (esclude RQ5 già collegata)
  await page.route(/\/rpc\/get_rq_available_for_pagopa/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 7, number: '7', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 }])
    });
  });
  
  // Mock elenco RQ di base
  await page.route(/\/rest\/v1\/rateations.*is_quater=true/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 5, number: '5', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 },
        { id: 7, number: '7', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 },
      ])
    });
  });

  // Mock PagoPA allocation
  await page.route(/\/rest\/v1\/v_pagopa_allocations.*$/i, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ pagopa_id: 34, pagopa_number: 'N.34', taxpayer_name: 'ACME',
        owner_uid: 'me', allocatable_cents: 1785164, residual_cents: 1785164 }])
    });
  });

  // Apri dialog e seleziona PagoPA N.34
  await openMigrationDialog(page);
  await page.getByText('N.34', { exact: false }).first().click();

  // Nella select RQ DEVE comparire solo "7" (non "5", già collegata)
  await expect(page.getByText('7', { exact: false })).toBeVisible();
  await expect(page.getByText('5', { exact: false })).toHaveCount(0);
});

test('Fallback client-side quando RPC fallisce', async ({ page }) => {
  // Mock RPC che fallisce
  await page.route(/\/rpc\/get_rq_available_for_pagopa/i, route => {
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'DB error' }) });
  });
  
  // Mock elenco RQ di base
  await page.route(/\/rest\/v1\/rateations.*is_quater=true/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 5, number: '5', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 },
        { id: 7, number: '7', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 },
      ])
    });
  });

  // Mock collegamenti esistenti (RQ5 già collegata)
  await page.route(/\/rest\/v1\/riam_quater_links.*$/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ riam_quater_id: 5, pagopa_id: 34 }])
    });
  });

  // Mock PagoPA allocation
  await page.route(/\/rest\/v1\/v_pagopa_allocations.*$/i, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ pagopa_id: 34, pagopa_number: 'N.34', taxpayer_name: 'ACME',
        owner_uid: 'me', allocatable_cents: 1785164, residual_cents: 1785164 }])
    });
  });

  await openMigrationDialog(page);
  await page.getByText('N.34', { exact: false }).first().click();

  // Fallback client-side: deve comunque escludere RQ5 (già collegata)
  await expect(page.getByText('7', { exact: false })).toBeVisible();
  await expect(page.getByText('5', { exact: false })).toHaveCount(0);
});