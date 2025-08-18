// Test file to verify robust date parsing functionality
import { parseItalianDateToISO, formatISOToItalian, isValidISODate } from './date';

// Test data for common OCR scenarios
const testCases = [
  // Standard formats
  { input: '15/03/2024', expected: '2024-03-15' },
  { input: '5/3/24', expected: '2024-03-05' },
  { input: '02-11-2024', expected: '2024-11-02' },
  { input: '1.12.2023', expected: '2023-12-01' },
  
  // OCR errors (O→0, l→1)
  { input: '15/O3/2O24', expected: '2024-03-15' },
  { input: 'l5/03/2024', expected: '2024-03-15' },
  
  // Italian months
  { input: '15 marzo 2024', expected: '2024-03-15' },
  { input: '2 nov 2023', expected: '2023-11-02' },
  { input: '1 gennaio 2024', expected: '2024-01-01' },
  
  // With spaces and noise
  { input: 'data: 15 / 03 / 2024', expected: '2024-03-15' },
  { input: '  15-03-2024  ', expected: '2024-03-15' },
];

// Manual test function (will be logged to console)
function runTests() {
  console.log('🧪 Testing Italian Date Parser...\n');
  
  testCases.forEach(({ input, expected }, index) => {
    const result = parseItalianDateToISO(input);
    const passed = result === expected;
    console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
    console.log(`  Input: "${input}"`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Got: ${result}`);
    if (!passed) console.log(`  ❌ FAILED`);
    console.log('');
  });
  
  // Test formatting
  console.log('🎨 Testing Italian Formatting...\n');
  const isoDate = '2024-03-15';
  const formatted = formatISOToItalian(isoDate);
  console.log(`ISO "${isoDate}" → Italian "${formatted}"`);
  console.log(`Expected: "15-03-2024", Got: "${formatted}" ${formatted === '15-03-2024' ? '✅' : '❌'}`);
  
  // Test validation
  console.log('\n✅ Testing Date Validation...\n');
  const validDates = ['2024-03-15', '2023-12-31', '2024-02-29']; // 2024 is leap year
  const invalidDates = ['2024-13-15', '2024-02-30', 'invalid', ''];
  
  validDates.forEach(date => {
    const isValid = isValidISODate(date);
    console.log(`"${date}" → ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });
  
  invalidDates.forEach(date => {
    const isValid = isValidISODate(date);
    console.log(`"${date}" → ${isValid ? '❌ Should be Invalid' : '✅ Correctly Invalid'}`);
  });
}

// Export for potential use
export { runTests };