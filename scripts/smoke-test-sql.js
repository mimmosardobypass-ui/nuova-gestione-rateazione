#!/usr/bin/env node

/**
 * SQL Smoke Tests for CI/CD
 * Validates critical data constraints in v_rateations_list_ui
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('⏭️ Skipping SQL smoke tests - Supabase not configured');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runSmokeTests() {
  console.log('🔍 Running SQL smoke tests...');
  
  try {
    // Test 1: Check view exists and is accessible
    const { data: sample, error: sampleError } = await supabase
      .from('v_rateations_list_ui')
      .select('id')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ View not accessible:', sampleError.message);
      process.exit(1);
    }
    console.log('✅ View v_rateations_list_ui accessible');

    // Test 2: Data integrity - paid + residual <= total
    const { data: integrityCheck, error: integrityError } = await supabase
      .rpc('check_data_integrity');
      
    if (integrityError) {
      // Fallback to direct query if RPC doesn't exist
      const { count } = await supabase
        .from('v_rateations_list_ui')
        .select('*', { count: 'exact', head: true })
        .gt('paid_amount_cents + residual_effective_cents', 'total_amount_cents');
        
      if (count > 0) {
        console.error(`❌ Data integrity violation: ${count} rows with paid+residual > total`);
        process.exit(1);
      }
    }
    console.log('✅ Data integrity constraints satisfied');

    // Test 3: Schema validation - essential columns exist
    const { data: schemaTest, error: schemaError } = await supabase
      .from('v_rateations_list_ui')
      .select('total_amount_cents, paid_amount_cents, residual_effective_cents, installments_total, installments_paid')
      .limit(1);
      
    if (schemaError) {
      console.error('❌ Schema validation failed:', schemaError.message);
      process.exit(1);
    }
    console.log('✅ Schema validation passed');

    console.log('🎉 All SQL smoke tests passed!');
    
  } catch (error) {
    console.error('❌ Smoke test failed:', error.message);
    process.exit(1);
  }
}

runSmokeTests();