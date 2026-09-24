import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { currentUser } from '../middleware/auth';
import { reviewQueue } from '../services/review-queue';

export const reviewQueueRoutes = new Hono<AppEnv>();
reviewQueueRoutes.get('/', async (c) => ok(c.get('requestId'), await reviewQueue({ user: currentUser(c), roles: c.get('roles') })));
