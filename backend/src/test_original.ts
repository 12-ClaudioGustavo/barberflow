import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:12-ClaudioGustavo@db.pfutktceyomnlhgspwbd.supabase.co:5432/postgres';

async function testOriginal() {
  console.log('Testando conexão direta original...');
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('✅ SUCESSO na conexão direta!');
    const res = await client.query('SELECT version()');
    console.log('Versão:', res.rows[0]);
    await client.end();
  } catch (err: any) {
    console.log('❌ FALHA na conexão direta:', err.message || err);
    try {
      await client.end();
    } catch (e) {}
  }
}

testOriginal();
