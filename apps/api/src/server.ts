import { createApp } from './app';
import { loadConfig } from './config';

try {
  const config = loadConfig();
  createApp(config).listen(config.port, () => {
    console.log(`API escuchando en el puerto ${config.port}`);
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
