import { test, expect } from '@playwright/test';

// Helper per aprire la pagina e il dialog
async function openMigrationDialog(page) {
  await page.goto('/rateazioni');
  // Apri il dialog della rateazione N.34 (adatta il trigger se diverso)
  await page.getByRole('button', { name: /gestisci migrazione/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('Usa tutto imposta il massimo ed abilita Migra dopo aver scelto RQ', async ({ page }) => {
  // Mock: una PagoPA con allocatable > 0 + 1 RQ attiva
  await page.route(/\/rest\/v1\/v_pagopa_allocations.*$/i, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ pagopa_id: 34, pagopa_number: 'N.34', taxpayer_name: 'ACME',
        owner_uid: 'me', allocatable_cents: 1785164, residual_cents: 1785164 }])
    });
  });
  await page.route(/\/rest\/v1\/rateations.*is_quater=true.*$/i, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 5, number: '5', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 }])
    });
  });

  await openMigrationDialog(page);

  // Seleziona la PagoPA N.34
  await page.getByText('N.34', { exact: false }).first().click();

  // Quota inizialmente disabilitata solo se allocatable=0; qui è > 0
  const quotaInput = page.getByTestId('rq-quota-input');
  await expect(quotaInput).toBeEnabled();

  // Usa tutto → quota = massimo disponibile
  await page.getByTestId('rq-use-all').click();
  // Valore in formato it-IT (es: 17.851,64); verifichiamo solo che non sia vuoto
  await expect(quotaInput).not.toHaveValue('');

  // Finché non scelgo la RQ, Migra resta disabilitato
  const migrateBtn = page.getByTestId('rq-migrate-btn');
  await expect(migrateBtn).toBeDisabled();

  // Seleziona RQ 5 → bottone si abilita
  await page.getByText(/Riammissione Quater di destinazione|Rateazione di Destinazione/i).scrollIntoViewIfNeeded();
  await page.getByText('5', { exact: false }).first().click();
  await expect(migrateBtn).toBeEnabled();
});

test('allocatable = 0 → input disabilitato, hint visibile, Migra disabilitato', async ({ page }) => {
  await page.route(/\/rest\/v1\/v_pagopa_allocations.*$/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ pagopa_id: 34, pagopa_number: 'N.34', taxpayer_name: 'ACME',
        owner_uid: 'me', allocatable_cents: 0, residual_cents: 100000 }])
    });
  });
  await page.route(/\/rest\/v1\/rateations.*is_quater=true.*$/i, route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await openMigrationDialog(page);
  await page.getByText('N.34', { exact: false }).first().click();

  await expect(page.getByTestId('rq-quota-input')).toBeDisabled();
  await expect(page.getByText(/Nessuna quota disponibile/i)).toBeVisible();
  await expect(page.getByTestId('rq-migrate-btn')).toBeDisabled();
});

test('quota > massimo → errore inline e Migra disabilitato', async ({ page }) => {
  await page.route(/\/rest\/v1\/v_pagopa_allocations.*$/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ pagopa_id: 34, pagopa_number: 'N.34', taxpayer_name: 'ACME',
        owner_uid: 'me', allocatable_cents: 99, residual_cents: 99 }]) // €0,99
    });
  });
  await page.route(/\/rest\/v1\/rateations.*is_quater=true.*$/i, route => {
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 5, number: '5', taxpayer_name: 'Mario Rossi', quater_total_due_cents: 120000 }])
    });
  });

  await openMigrationDialog(page);
  await page.getByText('N.34', { exact: false }).first().click();
  await page.getByText('5', { exact: false }).first().click();

  const quota = page.getByTestId('rq-quota-input');
  await quota.fill('1,00'); // €1,00 > €0,99
  await expect(page.getByText(/La quota deve essere tra/i)).toBeVisible();
  await expect(page.getByTestId('rq-migrate-btn')).toBeDisabled();
});