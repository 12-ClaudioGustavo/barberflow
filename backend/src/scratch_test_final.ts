import { db } from './infrastructure/database/pg.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFinal() {
  console.log('Testing backend pg pool connection...');
  try {
    const res = await db.query('SELECT NOW()');
    console.log('✅ BACKEND DB CONNECTION SUCCESSFUL! DB Time:', res.rows[0].now);
  } catch (err: any) {
    console.error('❌ BACKEND DB CONNECTION FAILED:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    process.exit(0);
  }
}

testFinal();
