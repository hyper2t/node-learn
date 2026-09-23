# Node Learn

Learning-relationship platform for students and teachers. One Expo codebase for iOS, Android and Web; a Hono API that runs locally and as an Appwrite Function; Appwrite Cloud (TablesDB, Storage, Auth) underneath.

## Stack

| Layer | Tech |
|---|---|
| App | Expo SDK 57 · React Native 0.86 · React 19 · Expo Router · NativeWind · TanStack Query · Zustand · React Hook Form + Zod |
| API (BFF) | Hono 4 · `@hono/node-server` locally (port **8070**) · same app bundled with esbuild into the Appwrite Function `node-learn-api` |
| Data / auth | Appwrite Cloud `sfo` · project `6ab149e4001d09a18de3` · TablesDB `main` (23 tables) · buckets `evidence` / `avatars` · email+password, Google, Notion |
| Tooling | TypeScript 6 · ESLint (expo) · Vitest · `appwrite-cli` · EAS |

Repository map:

```
src/app/             Expo Router screens (auth/, onboarding/, (app)/, legal/)
src/features/        identity · teachers · requests · learning · messaging · connections · notifications · admin
src/infrastructure/  appwrite client (web/native), API client (JWT + idempotency), uploads, env
src/shared/          UI kit, hooks, i18n, layout
backend/src/         Hono app: routes → services → db (TablesDB); contracts/api.ts is the shared API contract
backend/scripts/     ensure-tables · seed · smoke · make-dev-user · build-function · check-schema · verify-deploy
functions/           esbuild output pushed to Appwrite (generated, do not edit)
appwrite/            config-as-code extras (email templates + push script)
appwrite.config.json Project settings, function, buckets, tables — keep in sync with backend/src/db/schema.ts
docs/plans/          Audit + phase plans · docs/runbooks/deploy-api.md · docs/legal/
```

## Getting started

```bash
npm install && npm --prefix backend install
cp .env.example .env                    # public EXPO_PUBLIC_* only
cp backend/.env.example backend/.env    # add APPWRITE_API_KEY (never commit)

npm run dev:api                         # Hono on http://localhost:8070  (/healthz, /readyz)
npm run web                             # Expo web on http://localhost:8071
npm run ios | npm run android           # simulators; Expo Go works for everything except native OAuth return
```

First-time backend setup against a fresh Appwrite project: `npm run api:tables` (idempotent), then `npm run api:seed` and `npm run api:make-dev-user`.

## Quality gates

```bash
npm run check          # typecheck + lint + vitest (app) + contract/schema check + typecheck + vitest (api)
npm run api:smoke      # end-to-end against the real Appwrite project (needs backend/.env)
npm run api:test       # backend unit tests only
```

CI (`.github/workflows/ci.yml`) runs the same gates plus `expo export --platform web` on every push/PR.

## Deploying

- **Functions** → `npm run deploy:functions` (esbuild → push vars → push API + retention purge + healthcheck → verify API). API-only: `npm run deploy:api`; retention-only: `npm run deploy:purge`; healthcheck-only: `npm run deploy:healthcheck`. Runbook: `docs/runbooks/deploy-api.md`. Current API Function domain: `https://6ab25202000c575857b2.appwrite.network`.
- **Project settings / tables / buckets** → `appwrite push settings`, `npm run api:tables`. `npm run api:typecheck` fails if `db/schema.ts` and `appwrite.config.json` disagree.
- **Function variables** → `npm run api:push-vars` (the CLI's `push --with-variables` is a no-op in 27.x).
- **Auth email templates** → `npm run appwrite:email-templates:check` locally, then `npm run appwrite:email-templates` after custom SMTP is enabled.
- **Mobile** → `eas build --profile preview|production` (`eas.json`). **Web** → `npm run build:web` (static bundle in `dist/`, served by any static host; `npm run export:web` is the same export without the clean bundler cache).

## Environment variables

Front end uses only `EXPO_PUBLIC_*` (bundled into the client — never secrets): `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_PROJECT_NAME`, `APPWRITE_PLATFORM` (= bundle id `com.hyperter96.nodelearn`), `APPWRITE_DATABASE_ID`, `API_BASE_URL`, `API_MOCK`, `WEB_URL`.
Back end: `APPWRITE_ENDPOINT / PROJECT_ID / API_KEY / DATABASE_ID / ADMIN_TEAM_ID / EVIDENCE_BUCKET_ID / AVATAR_BUCKET_ID`, `PORT`, `CORS_ORIGINS`, `RATE_LIMIT_PER_MIN`, `LOG_LEVEL`, `NODE_ENV`, `API_DEV_BYPASS_USER_ID`. In the Function the API key is Appwrite's per-execution dynamic key; the rest come from `functions[].vars` in `appwrite.config.json`.

## Conventions

See `AGENTS.md` (Expo rules, commands) and `docs/planning-prompts/README.md` (product decisions). UI copy is English; planning docs are Chinese.
