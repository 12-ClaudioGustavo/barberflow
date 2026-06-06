import { supabase } from './infrastructure/database/supabase.js';

async function testJoin() {
  console.log('Testing join query with Supabase SDK...');
  try {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
        id,
        hiring_date,
        commission_percentage,
        users (
          id,
          name,
          email,
          phone,
          avatar_url,
          is_active
        )
      `);
    if (error) {
      console.error('❌ Join test failed:', error.message);
    } else {
      console.log('✅ Join test success! Data:', JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error('❌ Exception:', err.message);
  } finally {
    process.exit(0);
  }
}

testJoin();
