/**
 * Dev-only embedded PostgreSQL — used when Docker isn't available.
 *
 *   npm run db:embedded   → downloads a Postgres binary on first run,
 *                           starts it on :5432 with fleet/fleet + fleetdb.
 *
 * The production topology (docker-compose) is unchanged — this exists purely
 * so `prisma migrate` / `npm run seed` work without a Docker daemon.
 */
import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', '.pgdata');
fs.mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'fleet',
  password: 'fleet',
  port: 5432,
  persistent: true,
  initdbFlags: ['--encoding=UTF8'],
  onLog: (m: string) => process.stdout.write(m),
  onError: (m: string) => process.stderr.write(m),
});

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('fleetdb').catch(() => {});
  console.log('[dev-db] embedded Postgres running on 127.0.0.1:5432 (fleet/fleet, db=fleetdb)');
  console.log('[dev-db] press Ctrl+C to stop');
}

const shutdown = async () => { await pg.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => { console.error(e); process.exit(1); });
