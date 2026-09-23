# Runbook — deploy the Node Learn Appwrite Functions

The same Hono app runs locally (`@hono/node-server`, port 8070) and in production as the Appwrite Function `node-learn-api` (`backend/src/entry-appwrite.ts` adapter). Retention/deleted-data cleanup runs as the scheduled Appwrite Function `node-learn-purge-deleted` (`backend/src/entry-purge-deleted.ts`). API uptime is checked by the scheduled Function `node-learn-healthcheck` (`backend/src/entry-healthcheck.ts`).

## One-time setup
1. `npm i -g appwrite-cli` and `appwrite login` (or `appwrite client --endpoint https://sfo.cloud.appwrite.io/v1 --project-id 6ab149e4001d09a18de3 --key <API key>`).
2. Function variables are declared in `appwrite.config.json` → `functions[].vars` and synced by the deploy scripts (`push-vars` runs per Function).
   (`appwrite push function --with-variables` is a silent no-op in appwrite-cli 27.x — on 2026-09-22 the Function ran with 0 variables because of it).
   `APPWRITE_API_KEY` is **not needed**: API/retention Function adapters use Appwrite's per-execution dynamic key (`x-appwrite-key`), scoped by `functions[].scopes`. `APPWRITE_ENDPOINT`/`APPWRITE_PROJECT_ID` also fall back to the runtime's `APPWRITE_FUNCTION_*` values. API variables: `NODE_ENV=production`, `APPWRITE_DATABASE_ID=main`, `APPWRITE_ADMIN_TEAM_ID=admins`, `APPWRITE_EVIDENCE_BUCKET_ID=evidence`, `APPWRITE_AVATAR_BUCKET_ID=avatars`, `CORS_ORIGINS` (add `https://<web-host>` when the web domain exists), `LOG_LEVEL=info`, `RATE_LIMIT_PER_MIN=120`. Retention variables: `NODE_ENV=production`, Appwrite IDs/buckets, `LOG_LEVEL=info`. Healthcheck variables: `HEALTHCHECK_URL`, `HEALTHCHECK_TIMEOUT_MS`, `ALERT_WEBHOOK_URL`. `ALERT_WEBHOOK_URL` is marked `__SET_IN_APPWRITE_CONSOLE__`; `push-vars` preserves that manual secret instead of overwriting it. Do **not** set `API_DEV_BYPASS_USER_ID` (ignored in production anyway). Variables only apply to **new** deployments — push, then deploy.
   Moderators = confirmed members of Appwrite team `admins` (`appwrite teams create-membership --team-id admins --user-id <id> --roles owner`).
3. Console → Auth → Settings: add platforms **Web** (`<web-host>`, `localhost`) and **Android/iOS** (`com.hyperter96.nodelearn`); enable Google + Notion OAuth with redirect URLs
   `https://<web-host>/auth/oauth-return`, `http://localhost:8071/auth/oauth-return`, `nodelearn://auth/oauth-return`.
   Project-level settings (auth methods, security policies, services) live in `appwrite.config.json` → `settings`; apply with `appwrite push settings --force` (done 2026-09-22: only email-password + jwt remain enabled).
4. Schema: `npm --prefix backend run tables:ensure -- --all` (idempotent; also run after every `appwrite.config.json` change). This includes retention indexes (`profiles.status+updatedAt`, `upload_intents.status+expiresAt`, `messages.senderId+createdAt`, etc.). `npm run api:typecheck` fails if `db/schema.ts` and `appwrite.config.json` disagree.
5. Email templates: `appwrite/email-templates/*.html` + `npm run appwrite:email-templates:check` locally, then `npm run appwrite:email-templates` after SMTP is enabled — **requires custom SMTP first** (Appwrite Cloud returns 400 otherwise; see `appwrite/email-templates/README.md`).

## Deploy
```bash
npm run check                 # all gates
npm run deploy:functions      # esbuild all functions → push vars → push API + retention + healthcheck → verify API
```
For API-only changes you may still use `npm run deploy:api`. For retention-only changes use `npm run deploy:purge`; for alert-only changes use `npm run deploy:healthcheck`.

Current API Function domain: `https://6ab25202000c575857b2.appwrite.network` (Console → Functions → node-learn-api → Domains). `deploy:api`/`deploy:functions` exit non-zero if any API post-deploy check fails; re-run the checks alone with `npm run api:verify-deploy`, or manually:
```bash
SMOKE_BASE_URL=https://<fn-domain> curl -s $SMOKE_BASE_URL/readyz     # {"data":{"ok":true,"checks":{"tablesDb":{...}}}}
```
`/readyz` returns 503 if the key/database is wrong — check variables before anything else.

Point the clients at it: `EXPO_PUBLIC_API_BASE_URL=https://<fn-domain>` in `eas.json` profiles and the web host env.

## Retention purge
- Function id: `node-learn-purge-deleted`; schedule: `0 3 * * *` (daily UTC unless Appwrite project settings say otherwise); timeout: 120s.
- Scope: expired pending uploads, deleted-member messages/evidence upload files after 30 days, idempotency keys after 24h, notifications after 90 days, resolved reports/audit rows after 12 months.
- Manual run: Console → Functions → node-learn-purge-deleted → Executions → **Create execution**, or CLI `appwrite functions create-execution --function-id node-learn-purge-deleted --async false`.
- Success logs include `retention_purge_finished` with counts. Missing files are ignored so the job is safe to re-run.

## Healthcheck alerts
- Function id: `node-learn-healthcheck`; schedule: `*/10 * * * *`; timeout: 30s; no Appwrite scopes required.
- It calls `HEALTHCHECK_URL` (currently the deployed API `/readyz`) and treats the check as healthy only when HTTP status is 200 and the response envelope contains `data.ok=true`.
- When unhealthy, it returns 503, logs `healthcheck_failed`, and posts a Slack-compatible JSON payload to `ALERT_WEBHOOK_URL` if that secret is present. Set the real webhook URL in the Appwrite Console or CI secret store before relying on alerts.
- Manual run: Console → Functions → node-learn-healthcheck → Executions → **Create execution**, or CLI `appwrite functions create-execution --function-id node-learn-healthcheck --async false`.

## Rollback
Appwrite keeps every deployment. Console → Functions → `<function id>` → Deployments → pick the previous one → **Activate**. Or from git: `git checkout <previous-tag> -- backend appwrite.config.json && npm run deploy:functions`.

## Observability
- Each request logs one JSON line `{"message":"http","route","status","latencyMs","requestId","userId"}`; 5xx are `level=error`. Console → Functions → Executions shows them; filter on `"level":"error"`.
- The retention job logs `retention_purge_started` and `retention_purge_finished` once per execution; alert on repeated `retention_function_failure` or zero executions for > 36h.
- The healthcheck job logs `healthcheck_ok` or `healthcheck_failed` every 10 minutes; alert delivery requires setting `ALERT_WEBHOOK_URL`.
- Every API response carries `X-Request-Id`; ask users for it when triaging.
