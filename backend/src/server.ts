import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getConfig } from './config';
import { log } from './log';

const config = getConfig();
if (!config.appwrite.apiKey) throw new Error('[config] APPWRITE_API_KEY is required for the Node server (the Appwrite Function uses a dynamic key instead).');
const app = createApp();

serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  log('info', 'api_listening', { port: info.port, env: config.env, database: config.appwrite.databaseId });
});
