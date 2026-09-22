# Runbook — deploy the Node Learn API as an Appwrite Function

The same Hono app runs locally (`@hono/node-server`, port 8070) and in production as the Appwrite Function `node-learn-api` (`backend/src/entry-appwrite.ts` adapter). No business logic differs.

## One-time setup
1. `npm i -g appwrite-cli` and `appwrite login` (or `appwrite client --endpoint https://sfo.cloud.appwrite.io/v1 --project-id 6ab149e4001d09a18de3 --key <API key>`).
2. Function variables are declared in `appwrite.config.json` → `functions[].vars` and synced with **`npm run api:push-vars`**
   (`appwrite push function --with-variables` is a silent no-op in appwrite-cli 27.x — on 2026-09-22 the Function ran with 0 variables because of it).
   `APPWRITE_API_KEY` is **not needed**: the adapter uses Appwrite's per-execution dynamic key (`x-appwrite-key`), scoped by `functions[].scopes`. `APPWRITE_ENDPOINT`/`APPWRITE_PROJECT_ID` also fall back to the runtime's `APPWRITE_FUNCTION_*` values. Declared: `NODE_ENV=production`, `APPWRITE_DATABASE_ID=main`, `APPWRITE_ADMIN_TEAM_ID=admins`, `APPWRITE_EVIDENCE_BUCKET_ID=evidence`, `APPWRITE_AVATAR_BUCKET_ID=avatars`, `CORS_ORIGINS` (add `https://<web-host>` when the web domain exists), `LOG_LEVEL=info`, `RATE_LIMIT_PER_MIN=120`. Do **not** set `API_DEV_BYPASS_USER_ID` (ignored in production anyway). Variables only apply to **new** deployments — push, then deploy.
   Moderators = confirmed members of Appwrite team `admins` (`appwrite teams create-membership --team-id admins --user-id <id> --roles owner`).
3. Console → Auth → Settings: add platforms **Web** (`<web-host>`, `localhost`) and **Android/iOS** (`com.hyperter96.nodelearn`); enable Google + Notion OAuth with redirect URLs
   `https://<web-host>/auth/oauth-return`, `http://localhost:8071/auth/oauth-return`, `nodelearn://auth/oauth-return`.
   Project-level settings (auth methods, security policies, services) live in `appwrite.config.json` → `settings`; apply with `appwrite push settings --force` (done 2026-09-22: only email-password + jwt remain enabled).
4. Schema: `npm --prefix backend run tables:ensure -- --all` (idempotent; also run after every `appwrite.config.json` change). `npm run api:typecheck` fails if `db/schema.ts` and `appwrite.config.json` disagree.
5. Email templates: `appwrite/email-templates/*.html` + `npm run appwrite:email-templates` — **requires custom SMTP first** (Appwrite Cloud returns 400 otherwise; see `appwrite/email-templates/README.md`).

## Deploy
```bash
npm run check                 # all gates
npm run api:push-vars         # only when functions[].vars changed (idempotent; deletes undeclared keys)
npm run deploy:api            # esbuild → appwrite push function → verify-deploy (vars count, /readyz, CORS allow+deny, 401 envelope)
```
Current Function domain: `https://6ab25202000c575857b2.appwrite.network` (Console → Functions → node-learn-api → Domains). `deploy:api` exits non-zero if any post-deploy check fails; re-run the checks alone with `npm run api:verify-deploy`, or manually:
```bash
SMOKE_BASE_URL=https://<fn-domain> curl -s $SMOKE_BASE_URL/readyz     # {"data":{"ok":true,"checks":{"tablesDb":{...}}}}
```
`/readyz` returns 503 if the key/database is wrong — check variables before anything else.

Point the clients at it: `EXPO_PUBLIC_API_BASE_URL=https://<fn-domain>` in `eas.json` profiles and the web host env.

## Rollback
Appwrite keeps every deployment. Console → Functions → node-learn-api → Deployments → pick the previous one → **Activate**. Or from git: `git checkout <previous-tag> -- backend && npm run deploy:api`.

## Observability
- Each request logs one JSON line `{"message":"http","route","status","latencyMs","requestId","userId"}`; 5xx are `level=error`. Console → Functions → Executions shows them; filter on `"level":"error"`.
- Alerts: Console → Project → Settings → Webhooks / or a scheduled Function that calls `/readyz` and posts to Slack when it is not 200 (not yet wired — see audit doc D5 follow-up).
- Every API response carries `X-Request-Id`; ask users for it when triaging.
