import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase URL or Service Role Key is missing on the backend. Ensure your environment variables are configured.');
}

// Inicializa o cliente do Supabase utilizando a Service Role Key 
// para ter permissões de bypass do RLS (essencial para regras de admin do backend)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
