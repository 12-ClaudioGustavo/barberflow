import { supabase } from './infrastructure/database/supabase.js';

async function testSDK() {
  console.log('Testing Supabase SDK connection...');
  try {
    const { data, error } = await supabase.from('tenants').select('*').limit(1);
    if (error) {
      console.error('❌ Supabase SDK failed:', error.message);
    } else {
      console.log('✅ Supabase SDK success! Tenants data:', data);
    }
  } catch (err: any) {
    console.error('❌ Exception in Supabase SDK test:', err.message);
  } finally {
    process.exit(0);
  }
}

testSDK();
