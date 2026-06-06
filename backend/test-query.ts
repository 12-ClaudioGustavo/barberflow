import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

async function run() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, status, owner_email, owner_name, notes, rejected_reason, approved_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Query Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Query Success! Row count:', data.length);
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

run();
