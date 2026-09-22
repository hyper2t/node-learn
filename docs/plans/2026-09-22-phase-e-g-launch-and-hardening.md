# Node Learn — 上线收口与加固计划（Phase E → G）

日期：2026-09-22 · 承接：`2026-09-22-mvp-audit-and-next-steps.md`（Phase A–D 代码侧已完成）
核实方式：本地门禁实跑 + `appwrite-cli 27.3.0` 直接查询云端项目 `6ab149e4001d09a18de3`（sfo）

---

## 0. 一句话结论

代码侧 A–D 全部属实、门禁全绿（前端 `tsc` + vitest 6/6；后端 schema-check + contract + `tsc` + vitest 17/17；git `main` 干净）。
但**云端与代码存在 5 处漂移**，其中 **Function 环境变量为 0 个** 直接导致线上 CORS 只放行 `localhost:8071`、moderation 无人可用。下一阶段的重心不是再写功能，而是：**把云端收口到与代码一致 → 补测试网 → 出第一个真机包**。

---

## 1. 云端实测状态（2026-09-22 10:50 UTC）

| 项 | 实测 | 与代码/文档的差异 |
|---|---|---|
| Function `node-learn-api` | ✅ live，2 次 CLI 部署（10:01 / 10:02 UTC），`latestDeploymentStatus=ready`；`GET /readyz` → 200，`tablesDb.latencyMs=888`（冷启动） | 审计文档 §2.1 仍写"未真正部署过" → 文档过时 |
| **Function 变量** | ❌ `list-variables` → `total: 0` | `appwrite.config.json` 声明 8 个 vars；`deploy:api` 带 `--with-variables` 却未生效。后果：`CORS_ORIGINS` 走代码默认值 `http://localhost:8071`；`APPWRITE_ADMIN_TEAM_ID` 空；`LOG_LEVEL`/`RATE_LIMIT` 走默认 |
| CORS 实测 | `Origin: http://localhost:8071` → 返回 ACAO ✅；`Origin: https://app.node-learn.example` → **无 ACAO 头** ❌ | 任何非 localhost 的 Web 前端都无法调线上 API |
| TablesDB `main` | ✅ 23 张表全部存在（与 `db/schema.ts` 一致） | — |
| Buckets | ✅ `avatars`（2 MB）/ `evidence`（25 MB），`fileSecurity=true` | — |
| Platforms | ✅ apple + android `com.hyperter96.nodelearn`，web `localhost` | ❌ 缺正式 Web 域名的 platform |
| OAuth | ✅ Google enabled（clientId 已配，`nativeEnabled=false`）；Notion enabled | 原生 OAuth 走 `createOAuth2Token` + 系统浏览器，不需要 nativeEnabled；但 **redirect 白名单是否含 `nodelearn://auth/oauth-return` 无法从 CLI 读取**，需真机验证 |
| Teams | ❌ 0 个 | `requireAdmin` 依赖 `APPWRITE_ADMIN_TEAM_ID` → 线上无 admin，`/v1/admin/*` 全 403 |
| Auth methods | ⚠️ 线上 `magic-url` / `email-otp` / `anonymous` / `invites` / `phone` 全为 **enabled** | `appwrite.config.json` 声明它们为 `false` → `appwrite push settings` 从未执行 |
| SMTP | `smtpEnabled=false` | 验证/找回邮件走 Appwrite 共享发信（限额 + 品牌为 Appwrite） |
| Users | 4 个（开发账号） | — |
| EAS | `extra.eas.projectId=""`；本机无 `eas-cli` | 无法 `eas build` |

## 2. 代码侧小缺口（本次通读发现）

| # | 位置 | 问题 | 处置 |
|---|---|---|---|
| C1 | `.env.example` / `src/infrastructure/config/env.ts` 默认值 / `.github/workflows/ci.yml` | `EXPO_PUBLIC_APPWRITE_PLATFORM=com.nodelearn.app`，但真实 bundle id 是 `com.hyperter96.nodelearn` | 三处统一 |
| C2 | `backend/app.json`、`backend/eas.json` | 0 字节空文件，疑似误建 | 删除 |
| C3 | 审计文档 D1 | 写 scheme `node-learn`，实际 `app.json` 与 `oauth.ts` 均为 `nodelearn`（代码一致，文档错） | 修正文档 |
| C4 | `src/infrastructure/appwrite/realtime.ts` | `const DB = 'main'` 硬编码 | 改为 `EXPO_PUBLIC_APPWRITE_DATABASE_ID`（默认 `main`） |
| C5 | `backend/src/middleware/auth.ts` | JWT 有哈希缓存，但 `getRolesOf()` 每请求查一次 DB | roles 并入同一缓存条目（TTL 同 JWT） |
| C6 | `backend/package.json#deploy:function` | 部署后无校验，导致"0 变量"静默发生 | 加 post-deploy 断言脚本 |
| C7 | `README.md` | 仍是 create-expo-app 模板 | 重写为项目说明（命令、端口、env、部署） |
| C8 | 前端测试 | 仅 2 个纯函数测试文件（outbox / validate），0 组件测试 | Phase F |

---

## 3. Phase E — 上线收口（阻塞发布 · 1–2 天）

> **执行记录 2026-09-22（E1–E3、E5–E7 已完成；E4 按决策 D1 暂缓；E8/E9 未在本轮范围）**
>
> - **E1** 根因：appwrite-cli 27.3.0 的 `push function --with-variables` 静默不推送（部署日志无变量步骤，`list-variables` 仍为 0）。改为 `functions create-variable --variable-id unique()` 逐个创建，10 个变量全部就位并重新部署。验证：`127.0.0.1:8071`（仅存在于变量、不在代码默认值中）preflight 返回 ACAO → 变量确实生效；`/readyz` 200（109 ms）。CLI 把这些变量标为 secret，`list-variables` 显示 `value: ""` 属正常。
> - **E2** `appwrite teams create --team-id admins`，Karen（`6ab22626c7d1ab238faa`）为 confirmed owner；`APPWRITE_ADMIN_TEAM_ID=admins` 写入 `appwrite.config.json` vars、`backend/.env`、`.env.example`。本地 dev-bypass 验证：Karen `/v1/me` → `isAdmin:true`，`/v1/admin/reports` → 200。
> - **E3** `appwrite push settings --force`：auth methods 仅剩 `email-password` + `jwt`；`passwordDictionary`/`personalDataCheck` 由 false → true。顺带把 6 个已启用服务显式写入 config `settings.services`，消除 diff 噪音。
> - **E5** 模板与推送脚本已入库（`appwrite/email-templates/*.en.html`、`npm run appwrite:email-templates`），但 Appwrite Cloud 返回 `400 SMTP must be enabled on the project to configure custom email templates` → **模板与 SMTP 强绑定**，D2 决策前无法生效；README 已写明顺序。
> - **E6** `EXPO_PUBLIC_APPWRITE_PLATFORM` 三处统一为 `com.hyperter96.nodelearn`；新增 `EXPO_PUBLIC_APPWRITE_DATABASE_ID`（`env.ts` 默认 `main`）供 `realtime.ts` 使用；删除 `backend/app.json`、`backend/eas.json` 空文件；审计文档 scheme 修正为 `nodelearn`、部署/CI/eas 三行状态更新；README 重写。
> - **E7** 新增 `backend/scripts/push-vars.mjs`（config → 云端幂等同步，含删除未声明键）与 `verify-deploy.mjs`（变量数一致、`/readyz`、每个 CORS origin 放行、未知 origin 拒绝、未鉴权 401 envelope）；`deploy:function` 末尾串接校验；根脚本 `api:push-vars` / `api:verify-deploy`。负向测试：注入未推送的 `CANARY_VAR` → 报 `cloud=10 config=11` 并 exit 1。
> - 门禁：`npm run check` 全绿（前端 vitest 6、后端 vitest 17、schema 23 表 2 桶同步）、`expo export --platform web` 成功。
> - 遗留给 E4/E9：正式域名确定后 → `CORS_ORIGINS` 追加 + `npm run api:push-vars` + `npm run deploy:api`；`project create-web-platform`；OAuth redirect；`eas.json`/`app.json` intentFilter 替换占位。

> 原则：**先让云端 = 代码**，再动新功能。每一步都有 CLI 验证命令。E1/E2/E6/E7 可立即执行；E3/E4/E5 需产品决策（见 §6）。

### 后端 / 运维

**E1. 推送 Function 变量并验证**
```powershell
# 方式 A：整体重推（vars 来自 appwrite.config.json）
appwrite push function --function-id node-learn-api --with-variables --force
# 方式 B：若 A 仍为 0，逐个创建
appwrite functions create-variable --function-id node-learn-api --key CORS_ORIGINS --value "http://localhost:8071,http://127.0.0.1:8071,https://<web-host>"
# 验证
appwrite functions list-variables --function-id node-learn-api --json   # total 应为 8
curl -s -D - -o NUL -X OPTIONS https://6ab25202000c575857b2.appwrite.network/v1/me -H "Origin: https://<web-host>" -H "Access-Control-Request-Method: GET" | findstr /i access-control-allow-origin
```
DoD：`total=8`；正式域名 preflight 返回 ACAO；`/readyz` 仍 200。

**E2. 创建 moderation 团队并启用 admin**
```powershell
appwrite teams create --team-id admins --name "Node Learn Moderators"
appwrite teams create-membership --team-id admins --user-id <你的 userId> --roles owner
```
→ `appwrite.config.json` functions[].vars 与 `backend/.env` 写入 `APPWRITE_ADMIN_TEAM_ID=admins` → 重跑 E1。
DoD：本地 `GET /v1/me` 返回 `isAdmin:true`；线上 `GET /v1/admin/reports` 200；非成员 403（已有测试 `admin.test.ts` 覆盖逻辑）。

**E3. Auth 方法收口（需决策 D3）**
```powershell
appwrite push settings   # 按 appwrite.config.json 关闭 magic-url / email-otp / anonymous / invites / phone
appwrite project get --json  # authMethods 只剩 email-password + jwt
```
DoD：云端 authMethods 与 config 一致；`appwrite pull settings` 无 diff。

**E4. 正式 Web 域名落地（需决策 D1）**
- `appwrite project create-web-platform --key <web-host> --name "Node Learn Web"`
- `CORS_ORIGINS` 加入 `https://<web-host>`（config.json vars + 重推）
- 替换 `eas.json` 两个 profile 的 `EXPO_PUBLIC_WEB_URL`、`app.json` Android intentFilter host、runbook 中 `<web-host>`
- Console → Auth → Google/Notion redirect 加 `https://<web-host>/auth/oauth-return`
DoD：Web 构建从该域名可完成 email 登录 + Google 登录 + 调 `/v1/me`。

**E5. 邮件发信（需决策 D2）**
- 最小：`appwrite project update-smtp` 配自定义 SMTP（Resend / SES / Postmark），`appwrite project create-smtp-test` 验证
- 顺带：`update-email-template` 定制 verification / recovery 两封模板（品牌名 + 链接指向 `EXPO_PUBLIC_WEB_URL`）
DoD：注册后 1 分钟内收到品牌邮件，验证链接落到 `/auth/verify` 并成功。

**E6. 代码清理（C1–C4、C7）**
- 统一 `EXPO_PUBLIC_APPWRITE_PLATFORM` 三处；删除 `backend/app.json`、`backend/eas.json`；修正审计文档 scheme；`realtime.ts` DB id 走 env；重写 README。
DoD：`npm run check` 绿；`grep -r "com.nodelearn.app"` 无结果。

**E7. 部署脚本加"防回归"校验（C6）**
- 新增 `backend/scripts/verify-deploy.mjs`：调 `appwrite functions list-variables --json` 断言 `total >= 7`；`GET <fn>/readyz` 断言 200 与 `checks.tablesDb.ok`；`OPTIONS <fn>/v1/me` 带每个 `CORS_ORIGINS` 断言 ACAO。
- `deploy:function` 末尾串上 `node scripts/verify-deploy.mjs`。
DoD：故意删一个变量后 `npm run deploy:api` 非 0 退出。

### 前端

**E8. EAS 接入与第一个真机包**
```powershell
npm i -g eas-cli   # 或 npx eas-cli@latest
eas login
eas init            # 写入 app.json extra.eas.projectId
eas build --platform android --profile preview   # APK，internal distribution
```
- 真机验证矩阵：email 注册→验证邮件→年龄门→角色→档案；Google OAuth（`nodelearn://auth/oauth-return` 回跳）；Notion OAuth；头像上传；证据附件（图片 + PDF）；Realtime 消息 <1s。
DoD：APK 可安装；矩阵 8 项全过；OAuth 回跳不落到浏览器。

**E9. Web 首次部署**
- `npm run export:web` → `dist/`；托管到 Appwrite Sites（项目已开启 `sites` 服务，可 `appwrite push site`）或任意静态托管。
- 构建时环境：`EXPO_PUBLIC_API_BASE_URL=https://6ab25202000c575857b2.appwrite.network`，`EXPO_PUBLIC_WEB_URL=https://<web-host>`。
DoD：`https://<web-host>` 可完整走通 MVP 闭环；`/legal/privacy`、`/legal/terms` 静态可达。

---

## 4. Phase F — 测试网补齐（C4 遗留 · 3–5 天，可与 E8/E9 并行）

### 后端

**F1. 真实 Appwrite 集成测试**
- `backend/tests/integration/`：`globalSetup` 用 `APPWRITE_DATABASE_ID=test_<runId>` 调 `ensure-tables.ts` 建库建表；`globalTeardown` 删库。串行（`fileParallelism:false`）。
- 用 `make-dev-user.ts` 创建 2 学生 + 1 老师 + 1 admin（加入 `admins` 团队），全程走 `API_DEV_BYPASS_USER_ID` 或真实 JWT。
- 覆盖：① roles/age-gate 守卫 ② request→accept→relation 幂等（重复 `Idempotency-Key` 返回同一 relation）③ message `sequence` 单调 + `afterSequence` 增量 + read 回执 ④ block 后 13 处写入全部 403 ⑤ upload intent 越权 complete 403 / 过期 409 / 坏 MIME 422 ⑥ export 包含全部表 → delete 后匿名化且 notifications 清空。
- CI：新 job `integration`，`if: github.event_name == 'push'`，secrets `APPWRITE_API_KEY_TEST`。
DoD：本地 `npm --prefix backend run test:integration` 绿；CI 两个 job 均绿。

**F2. roles 缓存并入 JWT 缓存（C5）**
- `resolveUserByJwt` 的缓存值扩展为 `{ user, roles }`；`getRolesOf` 仅在 miss 时调用；角色变更接口（`POST /v1/me/roles`）后主动 `invalidate(userId)`。
DoD：`jwt-cache.test.ts` 新增用例：命中期间改角色 → 立即失效。

**F3. 决定 `domain_events` 的去向**
- 目前只写不消费；`notify()` 已同步写通知。二选一：(a) 明确"审计留痕用，不消费"，写进 ADR；(b) 做最小消费者（定时 Function 每分钟扫 `processedAt IS NULL` → 投影 proof / 发通知）。
- 建议 (a)，把 (b) 留到需要异步投影时。

### 前端

**F4. RNTL 组件/Hook 测试**
- 装 `@testing-library/react-native` + vitest RN 预设（或切 jest-expo，二选一，避免双 runner）。
- `auth-form.test.tsx`：校验错误、提交禁用、OAuth 按钮触发 `openOAuth`。
- `profile-forms.test.tsx`：student / teacher 两表单的必填与 subjects 上限。
- `use-messages.test.ts`：断网发送 → outbox 落盘 → 恢复后 replay 一次且 `clientMessageId` 不重复。
- `gate.test.tsx`：mock `useMe` 的 6 种状态 → 断言 `router.replace` 目标。
DoD：前端测试 ≥ 15；CI 时间 < 3 分钟。

**F5. Playwright（web）3 条关键流**
- `e2e/`：注册→年龄门→角色→档案；请求→接受→工作台；发消息→断网→恢复重发。
- 用 `EXPO_PUBLIC_API_MOCK=1` 的内存 mock 跑（已有 mock 层），CI 无需真实 Appwrite。
DoD：`npx playwright test` 绿；失败留 trace。

---

## 5. Phase G — 运营与合规（与 F 并行 · 1–2 天）

- **G1. `purge-deleted` 定时 Function**：`appwrite.config.json` 新增 function，`schedule: "0 3 * * *"`，按 `docs/legal/data-retention.md` 清理 `deletedAt` 超期的匿名化行、过期 `upload_intents`、过期 `idempotency_keys`。复用 backend 的 `db/*`，esbuild 单独入口。
- **G2. `/readyz` 告警**：最小方案 = 外部 uptime 监控（UptimeRobot 等）每 5 分钟打 `/readyz`；或定时 Function 失败时 `messaging` 发邮件。
- **G3. 法务审阅** `src/content/legal.ts`（隐私声明 / 条款 / 16–17 岁年龄段合规，`MIN_AGE_BAND` 默认 `16_17` 待确认）。
- **G4. Function 冷启动**：`/readyz` 冷启动 888 ms；若前端首屏体感差，评估 `runtimeSpecification` 升档或用 `schedule` 每 5 分钟自 ping 保温（Appwrite Cloud 不保证）。

---

## 6. 需要产品/负责人决策的 5 个问题

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| D1 | 正式 Web 域名是什么？（当前占位 `app.node-learn.example`） | E4/E9、OAuth redirect、Android App Link、CORS | 先定一个子域，哪怕先指向 Appwrite Sites 默认域名 |
| D2 | 邮件发信用哪家 SMTP？ | E5；不配则验证邮件走 Appwrite 共享通道 | Resend（免费额度够 MVP） |
| D3 | 是否按 `appwrite.config.json` 关闭 magic-url/OTP/anonymous/invites/phone？ | E3；开着 = 攻击面 + 与规划"三种登录"不符 | 关闭 |
| D4 | 第一个真机包先出 Android APK 还是同时 iOS TestFlight？ | E8；iOS 需 Apple Developer 账号 + 可能的 Sign in with Apple 要求 | 先 Android，iOS 的 SIWA 风险单独评估 |
| D5 | `domain_events` 走 (a) 仅留痕 还是 (b) 最小消费者？ | F3 | (a) |

---

## 7. 执行顺序与并行建议

```
Day 1   E1 → E2 → E6 → E7            （后端/运维，全部可由 CLI 完成，约半天）
        E8 eas init + 首个 APK 排队    （前端，与上并行）
Day 2   D1/D2/D3 决策 → E3 → E4 → E5 → E9
        F4 起步（RNTL 基建）
Day 3-5 F1 集成测试 / F2 / F5 / G1 / G2  并行
        E8 真机矩阵验收
```

**立即可做、零决策依赖**：E1、E2、E6、E7、E8（到 `eas init` 为止）、F2、F4 基建。
