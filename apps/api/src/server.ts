import { createApp } from './app.js';
const app = await createApp({ logger: true });
try {
  await app.listen({ port: Number(process.env.PORT || 8080), host: '0.0.0.0' });
} catch {
  app.log.error('API startup failed. Check server configuration.');
  process.exit(1);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app.close();
  });
