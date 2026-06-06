import dotenv from 'dotenv';
dotenv.config({ path: '/home/claudiocj/Documentos/barbearia/backend/.env' });
import { createClient } from '@supabase/supabase-js';

async function test() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'superadmin@barberflow.com',
    password: 'senha' // I don't know the password the user set
  });

  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }

  const token = authData.session.access_token;
  console.log('Got token, fetching tenants...');

  const res = await fetch('http://localhost:3001/api/v1/super-admin/tenants?status=pending', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body);
}

test();
