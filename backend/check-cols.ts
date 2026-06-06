import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tenants';
  `);
  console.log(res.rows);
  await client.end();
}

run();
