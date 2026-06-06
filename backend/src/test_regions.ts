import pg from 'pg';
const { Client } = pg;

const password = '12-ClaudioGustavo';
const projectRef = 'pfutktceyomnlhgspwbd';

const regions = [
  'sa-east-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1'
];

async function findRegion() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Testando região ${region} (${host})...`);
    
    const client = new Client({
      host,
      port: 6543,
      database: 'postgres',
      user: `postgres.${projectRef}`,
      password: password,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 3000
    });

    try {
      await client.connect();
      console.log(`🎉 SUCESSO ABSOLUTO na região: ${region}!`);
      const res = await client.query('SELECT version()');
      console.log('Versão do BD:', res.rows[0]);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`❌ Região ${region} falhou: ${err.message || err}`);
      try {
        await client.end();
      } catch (e) {}
    }
  }
  console.log('Nenhuma região funcionou.');
  process.exit(1);
}

findRegion();
