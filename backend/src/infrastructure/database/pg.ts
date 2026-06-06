import { Pool } from 'pg';
import { parse } from 'pg-connection-string';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables.');
}

const poolConfig: any = parse(connectionString);

poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 10000;

if (connectionString.includes('pooler.supabase.com')) {
  poolConfig.ssl = 'no-verify';
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  connect: () => pool.connect(),
};
