import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initSockets } from './sockets';
import { gpsSimulator } from './services/gpsSimulator.service';
import { alertService } from './services/alert.service';

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  // Start the GPS simulator + periodic alert checks
  gpsSimulator.start();
  const alertInterval = setInterval(() => alertService.runChecks().catch(console.error), 5 * 60 * 1000);
  alertService.runChecks().catch(console.error);

  server.listen(env.port, () => {
    console.log(`[backend] listening on http://localhost:${env.port}`);
    console.log(`[backend] swagger docs at http://localhost:${env.port}/api/docs`);
  });

  const shutdown = () => {
    gpsSimulator.stop();
    clearInterval(alertInterval);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
