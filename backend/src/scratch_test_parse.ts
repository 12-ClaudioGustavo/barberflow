import { Client, type ClientConfig } from 'pg';
import { parse } from 'pg-connection-string';

const connectionString = 'postgresql://postgres.pfutktceyomnlhgspwbd:12-ClaudioGustavo@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function testParse() {
  console.log('Testing connection by parsing connection string and overriding ssl option...');
  const parsed = parse(connectionString);
  const config: ClientConfig = {
    host: parsed.host || undefined,
    port: parsed.port ? Number(parsed.port) : undefined,
    database: parsed.database || undefined,
    user: parsed.user || undefined,
    password: parsed.password || undefined,
    ssl: { rejectUnauthorized: false },
  };

  console.log('Parsed config:', { ...config, password: '***' });

  const client = new Client(config);
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ DATABASE CONNECTION SUCCESSFUL! DB Time:', res.rows[0].now);
    await client.end();
  } catch (err: any) {
    console.error('❌ DATABASE CONNECTION FAILED:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    process.exit(0);
  }
}

testParse();
