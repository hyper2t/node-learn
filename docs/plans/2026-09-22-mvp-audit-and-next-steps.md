# Node Learn — MVP 现状审计与下一阶段实施计划

日期：2026-09-22 · 范围：`E:\node-learn-en`（前端 Expo 57 + 后端 Hono/Appwrite）

---

## 1. 当前状态一句话

MVP 闭环（注册/登录 → 年龄门 → 角色 → 档案 → 找老师/请求 → 学习关系 → 目标/任务 → 证据/反馈 → 消息 → 进展投影）**端到端可跑通**，所有质量门禁绿色（`tsc`、`expo lint`、契约同步、后端 typecheck、4 个 vitest、真实 Appwrite smoke、web export）。但它是"功能齐全的骨架"：**可靠性、实时性、上传、测试覆盖和发布准备**四块尚未达到规划文档的 DoD。

---

## 2. 逐模块审计

图例：✅ 完成 · 🟡 可用但不达标 · ❌ 缺失

### 2.1 后端（`backend/`，53 个文件）

| 模块 | 状态 | 说明 |
|---|---|---|
| Hono 双适配器（Node + Appwrite Function） | ✅ | `server.ts` / `entry-appwrite.ts`，esbuild 打包 |
| 配置校验 / 结构化日志 / requestId / 错误 envelope | ✅ | Zod 校验 env；错误码在 `errors.ts` |
| CORS allowlist / 全局 rate limit / social 30 次/分 | ✅ | 缺 **body size limit** 与 **secure headers** |
| JWT 鉴权 + dev bypass | ✅ | JWT 每请求调 Appwrite `account.get`，无缓存（延迟 ~100–300ms） |
| TablesDB 22 张表 + ensure 脚本 | ✅ | `appwrite.config.json` 里 buckets/function 已声明，但 **tables 未写入 config**（只靠脚本） |
| Identity / roles / age-gate / profiles / identities / export / delete | ✅ | delete 会匿名化 + 删 Appwrite 用户 |
| Teachers 搜索 | 🟡 | 用 `Query.search/contains` 简单匹配，无排序/过滤 acceptingRequests |
| Requests / invitations / accept→relation | ✅ | 幂等 + 互斥 pending 检查 |
| Relations / goals / tasks / evidence / feedback / proof | ✅ | proof 为同步重算的可解释投影 |
| Messaging（sequence、幂等、read、增量拉取） | 🟡 | 正确性 OK；**无 Realtime 分发**，`messages` 行无 row permission，客户端只能轮询 |
| Connections / block / report | ✅ | block 检查 13 处调用 |
| Uploads（intent → 客户端直传 → complete 校验权限） | 🟡 | 后端完整；**前端未接入** |
| domain_events / audit_events | 🟡 | 只写表，**无消费者**（无通知、无投影解耦） |
| 测试 | ❌ | 仅 4 个测试（health/envelope/idempotency）；无 repository/权限/状态机测试 |
| Admin / moderation 处理 | ❌ | reports 只写入，无审核接口（`APPWRITE_ADMIN_TEAM_ID` 未使用） |
| 部署（Function push、staging、回滚） | ✅ | 2026-09-22 已通过 CLI 部署到 `6ab25202000c575857b2.appwrite.network`；Function 变量须用 `npm run api:push-vars`（CLI 27.3 的 `push --with-variables` 无效），详见 Phase E 计划 |

### 2.2 前端（`src/`，85 个文件）

| 模块 | 状态 | 说明 |
|---|---|---|
| Appwrite Account facade（email/Google/Notion、验证、找回） | ✅ | OAuth 的 provider 需在 Console 开启并配置 redirect |
| API client（JWT 缓存、401 单次重试、幂等键、ApiError） | ✅ | |
| 路由守卫（guest → 年龄门 → 角色 → 档案 → app） | ✅ | |
| UI kit / tokens / NativeWind / i18n | 🟡 | 缺 Dialog/Sheet/Skeleton/OfflineBanner；`confirm()` 用 `window.confirm`/`Alert` 临时替代 |
| Web 侧边栏（折叠持久化）+ 响应式布局 | ✅ | 手机端底部 Tab |
| 所有 MVP 页面 | ✅ | 但多数列表 **无分页加载更多**（teachers 有），无 Skeleton |
| 消息：optimistic + 失败重试 | 🟡 | 内存态，刷新即丢；**无 outbox 持久化**；4s 轮询 |
| 头像 / 证据附件上传 UI | ❌ | 契约与后端就绪 |
| 离线/陈旧提示、NetInfo | ❌ | |
| 站内通知（请求到达、反馈到达） | ❌ | 依赖 domain_events 消费 |
| 深链（邮件验证 / 重置 / OAuth 回调）原生侧 | 🟡 | scheme 仍是模板的 `nodelearnen`，`app.json` 未按 Node Learn 配置 |
| 测试（RNTL / Playwright） | ❌ | 0 个前端测试 |
| Web 隐私声明页 / 服务条款 | ❌ | 年龄门里 "Privacy notice" 无链接目标 |

### 2.3 工程与发布

| 项 | 状态 |
|---|---|
| 根/后端 npm scripts 对齐 proto-store | ✅ |
| `.env.example` 两份 | ✅ |
| CI（GitHub Actions 跑 `npm run check`） | ✅（C4，`.github/workflows/ci.yml`） |
| `eas.json`、bundle id、图标、splash | ✅ 代码侧（D1）；`extra.eas.projectId` 待 `eas init`（Phase E8） |
| 契约漂移检查 | ✅ |
| 观测：latency / error rate / projection lag | ❌ |

---

## 3. 主要风险（按影响排序）

1. **消息可靠性只到"服务端正确"**：客户端刷新丢失待发送消息；4s 轮询在多会话下放大 API 压力，且在 Function 部署模式下每次轮询都是一次冷启动计费。
2. **上传链路断裂**：证据只能是纯文本，与"真实作品作为证据"的产品定位冲突。
3. **零回归保护**：前端 0 测试、后端 4 测试，任何重构都无安全网。
4. **每请求校验 JWT**：BFF 每次都回源 Appwrite；上线后延迟和配额都会成问题。
5. **举报无人处理**：有 report 入口却无处置路径，是合规盲点（EU/UK 基线）。
6. **原生配置未收口**：scheme / bundle id / OAuth 回调 URL 未定，Google/Notion 原生登录尚不可验证。

---

## 4. 下一阶段计划（Phase A → D，约 4 个迭代）

每项都写明：产出 · 验证命令 · DoD。默认顺序即依赖顺序。

### Phase A — 可靠性基线（第 1 迭代）✅ 已完成 2026-09-22

> 实现记录：A1 `src/features/messaging/outbox.ts` + `useMessages` 重写（replay / lastSyncSequence / 30s 兜底轮询）；A2 后端 `memberReadPermissions` 写入 `conversations`/`messages` 行 + `scripts/backfill-permissions.ts`，前端 `infrastructure/appwrite/realtime.ts` 仅触发增量拉取；A3 已存在的 JWT 哈希缓存补充 `jwt-cache.test.ts`；A4 `bodyLimit(256KB)` + `secureHeaders` + `security.test.ts`。门禁：前端 vitest 3、后端 vitest 10、tsc/lint/export 全绿。


**A1. 消息 outbox 持久化 + 增量同步收口**
- 产出：`src/features/messaging/outbox.ts`（AsyncStorage，按 userId 隔离；`pending[]` + `lastSyncSequence` per conversation）；`useMessages` 启动时 replay outbox；登出清理。
- 验证：新增 RNTL 测试 `outbox.test.ts`（断网发送 → 重启 → 自动重发且不重复，依赖 `clientMessageId` 幂等）。
- DoD：刷新/重启后未发消息仍在并自动重发；服务端不产生重复行。

**A2. Appwrite Realtime 作为低延迟提示**
- 后端：`messaging.ts` 写 `messages` 行时增加 `Permission.read(Role.user(memberId))`（两名成员）；`conversations` 行同理。`ensure-tables` 打开 `rowSecurity`。
- 前端：`infrastructure/appwrite/realtime.ts` facade（web/native 分文件），`useConversationRealtime(conversationId)` 收到事件后只触发 `afterSequence` 增量拉取；断线重连后按 `lastSyncSequence` 补齐。轮询降级为 30s 兜底。
- 验证：两个浏览器会话互发消息 <1s 到达；断网 1 分钟恢复后无缺漏。
- DoD：Realtime 不是事实来源，关闭 Realtime 功能依旧正确。

**A3. JWT 校验缓存**
- 后端：`middleware/auth.ts` 增加进程内 LRU（key = sha256(jwt)，TTL = min(jwt exp, 60s)），日志只记 hash 前 8 位。
- 验证：vitest 用 fake clock 验证命中/过期；smoke 观察 `/v1/me` 延迟下降。

**A4. HTTP 安全收口**
- `app.ts` 增加 `bodyLimit(256kb)`、`secureHeaders()`；错误码 `payload_too_large`。
- 验证：新增测试 `security.test.ts`（超大 body 413、CORS 拒绝、缺 header 401）。

### Phase B — 上传与证据附件（第 2 迭代）✅ 已完成 2026-09-22

> 实现记录：B1 `src/infrastructure/uploads/{pick,upload,storage.*,urls}.ts`（`pickImage`/`pickDocument`、`validateFile` + `UPLOAD_LIMITS`、`uploadFile(purpose, file, {relationId, onProgress})` = intent → SDK `Storage.createFile` → complete；桶权限已加 `create("users")`，`upload_intents` 新增 `fileName`）；B2 `shared/ui/attachments.tsx`（`AttachmentPicker`/`AttachmentList`），`evidence/new.tsx` 多附件上传并提交 `attachmentFileIds`，后端 `assertEvidenceAttachments`（归属/用途/关系/状态校验，违者 422）+ `resolveAttachments`（`Tokens.createFileToken` 30 分钟缓存的 view URL，`EvidenceItem.attachments` 契约同步）；B3 Profile 头像更换（1:1 裁剪 → `uploadFile('avatar')` → `/v1/me.avatarFileId`），`Avatar` 组件按 `fileId` 渲染 preview。验证：`npm run smoke:uploads`（intent 201 → 提前 complete 409 → complete 200 → `/v1/me` 头像回写 → 超限/坏 MIME 422）全部通过；typecheck/lint/vitest/`expo export` 全绿。跨端手动矩阵与 `uploads.test.ts` 单测并入 Phase C4。


**B1. 上传 adapter**
- `src/infrastructure/uploads/{pick,upload}.ts`：`expo-image-picker` + `expo-document-picker`；web 用 `<input type=file>`；调用 `POST /uploads/intents` → Appwrite Storage `createFile`（web `appwrite`，native `react-native-appwrite`）→ `POST /uploads/complete`。
- 限制：evidence 20MB、avatar 2MB、MIME 白名单（与后端一致）。

**B2. 证据附件 UI**
- `evidence/new.tsx` 支持多附件（缩略图 + 移除 + 进度）；`evidence/[evidenceId].tsx` 展示附件（图片预览 / 文件下载，用 `getFileView` 带 JWT 的 URL）。
- **B3. 头像上传**：Profile 页头像可点击更换；`Avatar` 组件按 `avatarFileId` 渲染 `getFilePreview`。
- 验证：跨端手动矩阵（iOS/Android/Web × 图片/PDF）；后端 `uploads.test.ts` 覆盖越权 complete、过期 intent、MIME 拒绝。
- DoD：老师能在反馈页直接打开学生附件；非成员访问 403。

### Phase C — 通知、治理与测试网（第 3 迭代）✅ 已完成 2026-09-22（C4 的真实 Appwrite 集成测试 / RNTL / Playwright 移至 Phase D）

> 实现记录：C1 新表 `notifications`（userId/type/title/body/href/refType/refId/actorId/dedupeKey(unique)/readAt；索引 ix_user_created、ix_user_read、uq_dedupe），`services/notifications.ts` 的 `notify()` 在业务写之后同步写入（best-effort、自己触发不通知、按 dedupeKey 幂等），挂点：request.received/accepted/declined、task.assigned、evidence.submitted、feedback.added、connection.received/accepted；API `GET /v1/notifications?cursor&unreadOnly`、`GET /v1/notifications/summary`、`POST /v1/notifications/read {ids|all}`；前端 `/(app)/notifications` 列表（全部/未读、点击标记已读并深链）、侧边栏铃铛徽标（45s 轮询）、Profile 快捷入口。C2 `requireAdmin`（`APPWRITE_ADMIN_TEAM_ID` 团队成员，60s 缓存，未配置即无人是 admin）；`GET /v1/admin/reports?status`、`POST /v1/admin/reports/:id/resolve {action: dismiss|warn|suspend, note}`（warn → 给对方发系统通知；suspend → `users.updateStatus(false)` + 结束其活跃关系并通知另一方；写 `audit_events` + domain event）；`reports` 表新增 resolution/resolvedBy/resolvedAt/resolutionNote + ix_status_created；`Me.isAdmin`；前端 `/(app)/admin/reports` 仅 admin 可见（侧边栏 Shield 入口）。C3 教师搜索支持 `accepting`（默认 true，false 放宽为全部公开）、`sort=relevance|newest|most_reviewed`；反馈数改为整页一次查询（`evidenceReviewed` 真实值）；新增复合索引 ix_visibility_accepting；前端筛选面板（学科 / 仅接收中 / 排序）。C4 后端新增 `admin.test.ts`（401/403/422/放行）、`notifications.test.ts`（自通知抑制、去重、跨用户 markRead 不越权）→ 15 个；前端抽出纯模块 `uploads/limits.ts` + `validate.test.ts` → 6 个；`.github/workflows/ci.yml`（typecheck+lint+vitest+contract+backend+web export）。验证：`tables:ensure` 已应用；临时端口实测 `/v1/notifications*` 200、`/v1/teachers?accepting=false&sort=most_reviewed` 200、非 admin `/v1/admin/reports` 403。


**C1. 站内通知**
- 新表 `notifications`（userId、type、refType/refId、readAt）。`emitEvent` 后同步写通知（先不引入队列）：request.received / accepted、feedback.added、task.assigned、connection.received。
- API：`GET /v1/notifications?cursor`、`POST /v1/notifications/read`。前端：侧边栏/Tab 铃铛 + 列表页；未读数合并进 `qk.me`。

**C2. Moderation 最小闭环**
- `requireAdmin`（`APPWRITE_ADMIN_TEAM_ID` 成员）；`GET /v1/admin/reports?status=open`、`POST /v1/admin/reports/:id/resolve {action: dismiss|warn|suspend}`；suspend = Appwrite `users.updateStatus(false)` + 结束其活跃关系。
- 前端：`/(app)/admin/reports` 仅 admin 可见。审计写 `audit_events`。

**C3. 教师搜索改进**
- `subjects` 建 fulltext 索引；支持 `accepting=true` 过滤；排序：acceptingRequests → evidenceReviewed → memberSince。

**C4. 测试金字塔落地**
- 后端（vitest，真实 Appwrite 隔离 namespace `DATABASE_ID=test_<runId>`，串行、自动清理）：auth/roles/blocked 权限、request→relation 幂等、message sequence/incremental/read、upload 越权、export/delete。
- 前端：RNTL 覆盖 `auth-form`、`profile-forms`、`useMessages`、路由守卫状态机；Playwright（web）跑 3 条关键流：注册→年龄门→角色→档案、请求→接受→工作台、发消息→重试。
- CI：`.github/workflows/check.yml` 跑 `npm ci && npm run check && npm run api:test`（需要 secrets 的集成测试单独 job）。

### Phase D — 发布准备（第 4 迭代）✅ 代码侧已完成 2026-09-22（控制台侧操作见 `docs/runbooks/deploy-api.md`）

> 实现记录：D1 `app.json` → name Node Learn / slug node-learn / scheme `nodelearn` / iOS `com.hyperter96.nodelearn` + 权限文案 / Android package + App Link intent filter / expo-image-picker 插件；新增 `eas.json`（development/preview/production，`EXPO_PUBLIC_*` 按 profile 注入，Function 域名占位待替换）；`oauthReturnUrl()` 在独立构建下返回 `nodelearn://auth/oauth-return`（Expo Go 仍用 exp://），需在 Console 注册的三条 redirect 已写入注释与 runbook。D2 `npm run deploy:api`（esbuild → `appwrite push functions`），Function 适配器加兜底 500 envelope；runbook 含变量清单、验证、回滚。D3 `backend/scripts/check-schema.ts`（`db/schema.ts` ⇄ `appwrite.config.json` 双向一致 + createdAt/updatedAt + 桶存在），并入 `npm run api:typecheck`。D4 `/legal/privacy`、`/legal/terms`（`src/content/legal.ts` 单一数据源，web+native 同渲染，路由守卫放行；年龄门与设置页均有入口），`docs/legal/data-retention.md` 保留期表；删号同时清理 notifications。D5 `middleware/access-log.ts` 每请求一行 `{route,status,latencyMs,requestId,userId}`（5xx=error），`/readyz` 真查 TablesDB（10s 缓存，失败 503），`health.test.ts`；后端测试 17 个。D6 `confirm()`/`DialogHost` 统一替换 4 处 `window.confirm`/`Alert.alert`（web/native 同一可访问对话框，Esc/Enter），`Skeleton/SkeletonCard/SkeletonList`（教师、通知、消息列表），`OfflineBanner`（onlineManager；native 由 expo-network 喂状态），Load more 已在各列表存在。验证：全部门禁绿；`expo export` 产出 `dist/legal/*.html`；`build:function` 成功；本地 `/readyz` 200 且带 `checks.tablesDb.latencyMs`。
>
> 仍需人工（无法从代码侧完成）：Console 注册平台与 OAuth redirect；创建 Function 环境变量并 `npm run deploy:api`；把 Function 域名填回 `eas.json`/web env；`eas init` 填 `extra.eas.projectId`；`purge-deleted` 定时 Function（保留期执行）；法务审阅文案；真实 Appwrite 集成测试与 Playwright 关键流（C4 遗留）。


- **D1. 应用配置**：`app.json` → name `Node Learn`、slug `node-learn`、scheme `nodelearn`、bundle id `com.hyperter96.nodelearn`（对齐 `EXPO_PUBLIC_APPWRITE_PLATFORM`）、图标/splash；`eas.json` preview/production；Appwrite Console 注册平台与 OAuth redirect：`nodelearn://auth/oauth-return`、`https://<web>/auth/oauth-return`。
- **D2. 部署后端 Function**：`npm --prefix backend run build:function` → `appwrite push functions`；Function 环境变量；staging smoke 用 Function URL 作为 `SMOKE_BASE_URL`；写回滚步骤（重新 push 上一 tag）。
- **D3. `appwrite.config.json` 写入 tables 定义**：从 `db/schema.ts` 生成，让 `appwrite push` 与 `tables:ensure` 等价。
- **D4. 法务/合规页**：`/legal/privacy`、`/legal/terms` 静态路由（web + app 内 WebView），年龄门链接指向它；数据保留期与删除策略写入 `docs/`。
- **D5. 观测**：结构化日志加 `latencyMs`、`route`；Appwrite Function 执行失败告警；`/readyz` 检查 TablesDB 可达。
- **D6. UI 补齐**：Dialog/Sheet 替换 `window.confirm`、Skeleton、OfflineBanner（NetInfo）、列表分页 "Load more"、a11y 走查（焦点顺序、对比度、44px 触达）。

---

## 5. 明确不做（保持 MVP 边界）

支付/订阅、KYC、群组/Feed、知识图谱库、AI 助教、推送通知（先做站内）、复杂离线同步框架、多语言。

---

## 6. 建议的立即动作（本周）

1. Phase A 全部（A1–A4），它们互不依赖，可并行；先做 A2 后端权限部分，因为前端 Realtime 依赖它。
2. 同时开 CI 骨架（C4 的 workflow 部分），让后续每次提交都有门禁。
3. 在 Appwrite Console 开启 Google/Notion provider 并配置 web redirect，尽早验证 OAuth 真实链路。
