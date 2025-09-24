import { describe, it, expect } from "vitest";
import { mapListRowToUI } from "@/mappers/mapRateationListRow";
import { RateationListRowSchema } from "@/schemas/RateationListRow.schema";

describe("mapListRowToUI", () => {
  it("mappa correttamente cents → € e contatori (caso N.36)", () => {
    const raw = RateationListRowSchema.parse({
      id: 57,
      number: "36",
      tipo: "PagoPA",
      taxpayer_name: "ACME Srl",
      status: "ATTIVA",
      is_pagopa: true,
      is_f24: false,
      is_quater: false,
      type_id: 1,
      total_amount_cents: 1817457,
      paid_amount_cents: 32293,
      residual_effective_cents: 1785164,
      overdue_effective_cents: 0,
      installments_total: 84,
      installments_paid: 1,
      installments_overdue_today: 0,
    });

    const ui = mapListRowToUI(raw);

    // Verifica conversioni monetarie precise
    expect(ui.importoTotale).toBeCloseTo(18174.57, 2);
    expect(ui.importoPagato).toBeCloseTo(322.93, 2);
    expect(ui.residuo).toBeCloseTo(17851.64, 2);
    expect(ui.residuoEffettivo).toBeCloseTo(17851.64, 2);
    expect(ui.importoRitardo).toBeCloseTo(0, 2);

    // Verifica contatori e calcoli derivati
    expect(ui.rateTotali).toBe(84);
    expect(ui.ratePagate).toBe(1);
    expect(ui.rateNonPagate).toBe(83);
    expect(ui.rateInRitardo).toBe(0);

    // Verifica campi base
    expect(ui.numero).toBe("36");
    expect(ui.tipo).toBe("PagoPA");
    expect(ui.contribuente).toBe("ACME Srl");
    expect(ui.status).toBe("ATTIVA");
    expect(ui.is_pagopa).toBe(true);
  });

  it("gestisce valori null e zero correttamente", () => {
    const raw = RateationListRowSchema.parse({
      id: 1,
      number: null,
      tipo: null,
      taxpayer_name: null,
      status: null,
      is_pagopa: null,
      total_amount_cents: 0,
      paid_amount_cents: 0,
      residual_effective_cents: 0,
      overdue_effective_cents: 0,
      installments_total: 0,
      installments_paid: 0,
    });

    const ui = mapListRowToUI(raw);

    expect(ui.numero).toBe("");
    expect(ui.tipo).toBe("N/A");
    expect(ui.contribuente).toBe("");
    expect(ui.importoTotale).toBe(0);
    expect(ui.importoPagato).toBe(0);
    expect(ui.residuo).toBe(0);
    expect(ui.rateTotali).toBe(0);
    expect(ui.ratePagate).toBe(0);
    expect(ui.rateNonPagate).toBe(0);
    expect(ui.status).toBe("ATTIVA");
    expect(ui.is_pagopa).toBe(false);
  });

  it("calcola correttamente rateNonPagate", () => {
    const raw = RateationListRowSchema.parse({
      id: 2,
      total_amount_cents: 100000,
      paid_amount_cents: 50000,
      residual_effective_cents: 50000,
      overdue_effective_cents: 0,
      installments_total: 10,
      installments_paid: 5,
    });

    const ui = mapListRowToUI(raw);

    expect(ui.rateNonPagate).toBe(5); // 10 - 5
  });
});