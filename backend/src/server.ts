import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getConfig } from './config';
import { log } from './log';

const config = getConfig();
const app = createApp();

serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  log('info', 'api_listening', { port: info.port, env: config.env, database: config.appwrite.databaseId });
});
