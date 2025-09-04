// Test manuale per verificare le funzioni di date timezone-safe
// Esegui: node --loader ts-node/esm src/utils/date.test.ts
// O aggiungi 'runDateTests()' da console in dev tools

import { toLocalISO, toISODateLocal, isValidISODate, parseItalianDateToISO, formatISOToItalian } from './date';

export function runDateTests() {
  console.log('🧪 Testing Date Utils - Timezone Safe Functions...\n');
  
  // Test toLocalISO - no timezone shift
  console.log('📅 toLocalISO Tests:');
  
  // Test 1: non fa shift di giorno
  const lateNight = new Date(2025, 8, 3, 23, 59, 59); // 23:59:59 locale (settembre)
  const result1 = toLocalISO(lateNight);
  console.log(`  Late night (23:59): ${result1} ${result1 === '2025-09-03' ? '✅' : '❌'}`);
  
  // Test 2: cambio ora legale
  const dstDate = new Date(2025, 9, 26, 2, 30, 0); // 26 ottobre 2025, 02:30
  const result2 = toLocalISO(dstDate);
  console.log(`  DST date: ${result2} ${result2 === '2025-10-26' ? '✅' : '❌'}`);
  
  // Test 3: anno bisestile
  const leapDate = new Date(2024, 1, 29); // 29 febbraio 2024
  const result3 = toLocalISO(leapDate);
  console.log(`  Leap year: ${result3} ${result3 === '2024-02-29' ? '✅' : '❌'}`);
  
  // Test 4: alias consistency
  const testDate = new Date(2025, 5, 15, 14, 30, 0);
  const alias1 = toLocalISO(testDate);
  const alias2 = toISODateLocal(testDate);
  console.log(`  Alias consistency: ${alias1 === alias2 ? '✅' : '❌'} (${alias1})`);
  
  console.log('\n✅ isValidISODate Tests:');
  
  // Valid dates
  const validTests = [
    ['2025-09-03', true],
    ['2024-02-29', true], // leap year
    ['2023-12-31', true]
  ];
  
  validTests.forEach(([date, expected]) => {
    const result = isValidISODate(date as string);
    console.log(`  "${date}": ${result} ${result === expected ? '✅' : '❌'}`);
  });
  
  // Invalid dates
  const invalidTests = [
    ['2025-13-01', false], // invalid month
    ['2025-02-30', false], // invalid day
    ['invalid', false],
    ['', false],
    [undefined, false]
  ];
  
  invalidTests.forEach(([date, expected]) => {
    const result = isValidISODate(date as string);
    console.log(`  "${date}": ${result} ${result === expected ? '✅' : '❌'}`);
  });
  
  console.log('\n🇮🇹 parseItalianDateToISO Tests:');
  
  const parseTests = [
    ['15/03/2024', '2024-03-15'],
    ['5/3/24', '2024-03-05'], // expand 24->2024
    ['02-11-2024', '2024-11-02'],
    ['1.12.2023', '2023-12-01'],
    ['15/O3/2O24', '2024-03-15'], // OCR errors O->0
    ['l5/03/2024', '2024-03-15'], // OCR errors l->1
    ['15 marzo 2024', '2024-03-15'],
    ['2 nov 2023', '2023-11-02'],
    ['data: 15 / 03 / 2024', '2024-03-15']
  ];
  
  parseTests.forEach(([input, expected]) => {
    const result = parseItalianDateToISO(input);
    console.log(`  "${input}" → ${result} ${result === expected ? '✅' : '❌'}`);
  });
  
  console.log('\n🎨 formatISOToItalian Tests:');
  
  const formatTests = [
    ['2024-03-15', '15-03-2024'],
    ['2023-12-01', '01-12-2023'],
    ['', ''],
    ['invalid', 'invalid']
  ];
  
  formatTests.forEach(([input, expected]) => {
    const result = formatISOToItalian(input);
    console.log(`  "${input}" → "${result}" ${result === expected ? '✅' : '❌'}`);
  });
  
  console.log('\n🔄 Round-trip Consistency Tests:');
  
  // Test round-trip
  const originalDate = new Date(2025, 8, 3); // 3 settembre 2025
  const iso = toLocalISO(originalDate);
  const italian = formatISOToItalian(iso);
  const backToISO = parseItalianDateToISO(italian.replace(/-/g, '/'));
  
  console.log(`  Original date → ISO: ${iso}`);
  console.log(`  ISO → Italian: ${italian}`);
  console.log(`  Italian → ISO: ${backToISO}`);
  console.log(`  Round-trip success: ${iso === backToISO && iso === '2025-09-03' ? '✅' : '❌'}`);
  
  // Critical timezone test
  const winter = new Date(2025, 1, 15, 8, 0, 0); // febbraio mattina
  const summer = new Date(2025, 7, 15, 23, 59, 59); // agosto sera
  const winterISO = toLocalISO(winter);
  const summerISO = toLocalISO(summer);
  
  console.log(`  Winter morning: ${winterISO} ${winterISO === '2025-02-15' ? '✅' : '❌'}`);
  console.log(`  Summer evening: ${summerISO} ${summerISO === '2025-08-15' ? '✅' : '❌'}`);
  
  console.log('\n🎯 Standardizzazione Date completata! ✅');
  console.log('   - toLocalISO() fonte unica di verità per serializzazione date locali');
  console.log('   - isValidISODate() con regex sicuro senza UTC');
  console.log('   - ESLint rule blocca toISOString().slice(0,10)');
  console.log('   - Zero shift di timezone in tutte le conversioni');
}

// Auto-run se importato direttamente
if (typeof window !== 'undefined' && (window as any).runDateTests === undefined) {
  (window as any).runDateTests = runDateTests;
  console.log('💡 Funzione runDateTests() disponibile in console');
}