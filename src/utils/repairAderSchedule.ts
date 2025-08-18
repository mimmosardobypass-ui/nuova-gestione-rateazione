import { parse, addMonths, format } from "date-fns";

export type ScheduleRow = { 
  scadenza: string; 
  amount: number; 
};

const toDate = (dateStr: string) => parse(dateStr, "dd-MM-yyyy", new Date());

/**
 * Ripara una schedule di 9 rate ricostruendo la rata mancante
 * basandosi su pattern trimestrali/mensili
 */
export function repairAderSchedule(rows: ScheduleRow[]): ScheduleRow[] {
  if (rows.length !== 9) {
    console.log(`[repairAderSchedule] Input has ${rows.length} rows, repair only works for 9 rows`);
    return rows;
  }

  console.log(`[repairAderSchedule] Attempting to repair 9/10 schedule:`, rows.map(r => r.scadenza));

  const sorted = [...rows].sort((a, b) => 
    toDate(a.scadenza).getTime() - toDate(b.scadenza).getTime()
  );

  // Trova il gap più grande (probabile rata mancante)
  for (let i = 0; i < sorted.length - 1; i++) {
    const dateA = toDate(sorted[i].scadenza);
    const dateB = toDate(sorted[i + 1].scadenza);
    const diffDays = (dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24);
    
    console.log(`[repairAderSchedule] Gap between ${sorted[i].scadenza} and ${sorted[i + 1].scadenza}: ${diffDays} days`);
    
    // Se il gap è > 120 giorni (~4 mesi), probabile rata mancante a 3 mesi
    if (diffDays > 120) {
      const missingDate = addMonths(dateA, 3);
      const missingDateStr = format(missingDate, "dd-MM-yyyy");
      
      // Usa l'importo più comune come guess per la rata mancante
      const amounts = sorted.map(r => r.amount);
      const amountGuess = amounts.reduce((a, b, _, arr) => 
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      );
      
      const missingRow: ScheduleRow = {
        scadenza: missingDateStr,
        amount: amountGuess
      };
      
      console.log(`[repairAderSchedule] Inserting missing installment: ${missingDateStr} - €${amountGuess}`);
      
      sorted.splice(i + 1, 0, missingRow);
      break;
    }
  }

  // Se non abbiamo trovato un gap chiaro, prova alla fine della serie
  if (sorted.length === 9) {
    const lastDate = toDate(sorted[sorted.length - 1].scadenza);
    const secondLastDate = toDate(sorted[sorted.length - 2].scadenza);
    const avgInterval = (lastDate.getTime() - secondLastDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (avgInterval >= 80 && avgInterval <= 100) { // ~3 mesi
      const nextDate = addMonths(lastDate, 3);
      const nextDateStr = format(nextDate, "dd-MM-yyyy");
      
      const amounts = sorted.map(r => r.amount);
      const amountGuess = amounts.reduce((a, b, _, arr) => 
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      );
      
      console.log(`[repairAderSchedule] Adding final missing installment: ${nextDateStr} - €${amountGuess}`);
      
      sorted.push({
        scadenza: nextDateStr,
        amount: amountGuess
      });
    }
  }

  console.log(`[repairAderSchedule] Repair completed. Final schedule:`, sorted.map(r => r.scadenza));
  return sorted;
}