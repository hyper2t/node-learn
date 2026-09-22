# TypeScript + Appwrite 后端开发规划提示词

> 将以下整段提示词交给后端架构/开发规划 Agent。目标是产出可执行的 TypeScript + Appwrite 规划、数据契约和阶段任务，不立即堆砌全部后端功能。

---

你是一名资深 TypeScript、Hono、Appwrite、事件驱动架构、安全与数据建模工程师。请为 `E:\node-learn-en` 制定 `Node Learn` 全球英语版后端开发规划。后端使用 TypeScript + Appwrite，采用“Appwrite Account + Hono BFF + Appwrite Function + TablesDB/Storage/Realtime”的混合架构；MVP 支持学生端和老师端，不做支付、不做实名认证，图谱分析和联系人申请保持极简。

## 1. 必须先做的真实仓库分析

### 现有知节点：`E:\zhijiedian`

先阅读：

- `docs/zhijiedian-philosophy-and-engineering-constraints.md`
- `server/docs/backend-development-constraints.md`
- `server/docs/backend-architecture-plan.md`
- `server/docs/api-specification.md`
- `docs/im-chat-system-prd.md`
- `server/Cargo.toml`
- `server/apps/bff-http/src/app.rs`
- `server/apps/bff-http/src/state.rs`
- `server/apps/bff-http/src/routes/**`
- `server/crates/api-contracts/**`
- `server/crates/domain-identity/**`
- `server/crates/domain-learning/**`
- `server/crates/domain-matching/**`
- `server/crates/domain-messaging/**`
- `server/crates/domain-proof/**`
- `server/crates/infra-db-*`
- `server/migrations/**`

提炼而非照搬：BFF 只做 HTTP/鉴权/DTO/聚合；领域规则独立于框架；repository/port 隔离外部系统；API 合同集中；游标分页；幂等；结构化事件；Realtime 只负责低延迟、增量同步保证正确性；`LearningRelation` 是核心对象；消息先可靠落库再分发；审计与状态迁移可解释。

删除中国区特有能力：手机号短信、实名认证/OCR、身份证件、CNY 钱包/充值、支付、国内云服务商耦合。

### 技术参考：`E:\proto-store`

必须阅读：

- 根 `package.json` 与 `backend/package.json`
- `appwrite.config.json`
- `backend/src/app.ts`
- `backend/src/entry-appwrite.ts`
- `backend/src/server.ts`
- `backend/src/config.ts`
- `backend/src/app-env.ts`
- `backend/src/middleware/**`
- `backend/src/db/client.ts`
- `backend/src/db/schema.ts`
- `backend/src/db/rows.ts`
- `backend/src/db/repos/**`
- `backend/src/routes/**`
- `backend/src/schemas/**`
- `backend/src/services/**`
- `src/lib/appwrite/**`
- `src/lib/api/client.ts`
- `scripts/check-contract.mjs`

参考以下已验证模式：

- Hono 核心只写一遍，用 Web `Request/Response` 同时适配本地 Node 与 Appwrite Function。
- 客户端直接使用 Appwrite Account；业务 API 使用短期 Appwrite JWT。
- 服务端每请求创建 JWT client 验证用户；admin API key client 只在服务端存在。
- 使用 Appwrite TablesDB，而不是旧 Databases API。
- `appwrite.config.json` 配置即代码；表、索引、Functions、Buckets 有可重复部署脚本。
- Zod 严格校验、稳定错误码、request ID、rate limit、幂等键和游标分页。
- API contract 有单一来源或自动漂移检查。
- `entry-appwrite.ts` 只是适配器，不包含业务逻辑。

不要复制电商表、Stripe、订单、库存或数字商品逻辑。

### 目标项目：`E:\node-learn-en`

读取 `AGENTS.md`、根 `package.json` 和现有目录。规划前确认 Appwrite CLI、`node-appwrite`、Hono 和运行时的实际版本。所有 Appwrite API（尤其 TablesDB、Transactions、Realtime 权限、Function runtime）都必须查对应版本官方文档，不得从记忆假定能力存在。

输出开头必须列出：已确认事实、版本待确认项、参考项目可复用模式、必须重新设计的领域差异。

## 2. 业务与产品边界

MVP 只支持以下闭环：

```text
Account + role onboarding
→ student goal / teacher profile
→ learning request or invitation
→ accepted LearningRelation
→ goals + tasks + structured messages
→ evidence + feedback
→ simple proof/progress projection
```

支持：

- 一个 Appwrite user 拥有学生、老师或双角色；服务端维护 `availableRoles` 与 `activeRole`。
- Email/password、email verification、OAuth、recovery。
- 学生资料、老师自述资料、学习目标和可见性。
- 老师发现/精确搜索、学习申请、老师邀请。
- 学习关系、目标、任务、证据、反馈和简单证明。
- 私聊式协作会话、结构化消息、未读、幂等发送、断线补齐。
- 极简联系人申请：发出、接受、拒绝、撤回、屏蔽、举报。
- 头像与证据附件上传。
- 数据导出、账号删除/匿名化、审计和基础治理。

明确不做：

- 实名认证、教师执照强制认证、身份证/护照/人脸/OCR。
- 支付、订单、退款、钱包、订阅、Stripe。
- 复杂社群/群聊、Feed、粉丝、推荐好友、通讯录导入。
- 完整知识图数据库、复杂图算法、排行榜、神秘综合分。
- 自治 AI Agent 或自动决定学习结论。

## 3. 架构原则

采用“模块化单体 + Appwrite 托管基础设施”，不要过早拆微服务：

```text
Expo client
  ├─ Appwrite Account / OAuth / session
  ├─ approved Appwrite Realtime subscriptions
  └─ HTTPS + Appwrite JWT
       ↓
Hono BFF core
  ├─ Node adapter for local development
  └─ Appwrite Function adapter for production
       ↓
Application services / Domain modules
       ↓
Repositories / Ports
       ↓
Appwrite TablesDB / Storage / Users / Teams / Functions / Realtime
```

依赖方向：

```text
routes/middleware → application services → domain → repository interfaces
infrastructure adapters → domain/application ports
contracts 不依赖 Hono、React Native 或 node-appwrite
entry adapters 不包含业务规则
```

建议模块：

- `identity`：Appwrite user 映射、角色、会话上下文。
- `profiles`：学生/老师资料、handle、可见性。
- `matching`：学习请求、老师邀请、接受/拒绝。
- `connections`：极简联系人请求、联系人、block/report。
- `learning`：LearningRelation、goals、tasks、progress snapshots。
- `messaging`：conversation、member、message、receipt/sequence。
- `proof`：evidence、feedback、proof record。
- `moderation`：report、block、rate limit、治理审计。
- `notifications`：站内事件投影；推送可列 P1。

## 4. 推荐工程结构

请验证并输出最终目录树，起点如下：

```text
backend/
  package.json
  tsconfig.json
  src/
    app.ts
    app-env.ts
    config.ts
    server.ts
    entry-appwrite.ts
    errors.ts
    log.ts
    contracts/
    middleware/
    routes/
    schemas/
    application/
    domains/
      identity/
      profiles/
      matching/
      connections/
      learning/
      messaging/
      proof/
      moderation/
    db/
      client.ts
      schema.ts
      rows.ts
      repos/
    storage/
    realtime/
    events/
    mappers/
  scripts/
    ensure-tables.ts
    seed.ts
    build-function.mjs
    contract-check.mjs
    smoke.ts
  tests/
contracts/                  # 纯 TS DTO/schema 的单一来源或受控副本
functions/
  node-learn-api/
appwrite.config.json
```

说明 Node 版本、ESM/CJS、Appwrite Function 打包方式、source maps、环境变量校验和本地开发命令。Function bundle 必须可重复构建，不依赖本地 `node_modules` 被上传。

## 5. 身份、角色与权限

采用以下认证边界：

1. 客户端通过 Appwrite Account 建立 session。
2. 客户端创建短期 Appwrite JWT 调 BFF。
3. `requireAuth` 从 Bearer token 建立 user-scoped Appwrite client，调用 Account 获取用户；可短 TTL 缓存解析结果，但缓存键必须是 token hash，不能记录 token。
4. 服务端从角色表读取 `availableRoles`，不相信客户端传入角色。
5. `activeRole` 是用户当前视图选择；每个 route 仍需基于可用角色和资源成员关系授权。
6. admin API key 永不返回客户端，只在 BFF repository 中使用。
7. Realtime 可读行使用最小 row permissions；业务表默认不允许客户端直接写。

不做实名认证。老师资料必须明确 `selfDeclared`；如果规划 email/domain verification、人工审核或作品验证，它们是独立、可解释的 trust signal，不能命名为 government identity verified。

全球版默认采用年龄段自证和地区可配置数字同意年龄。建议 MVP 默认 `16+`，不保存精确生日；低于门槛阻止注册。此处需要法律评审，计划中必须标注。

## 6. Appwrite TablesDB 数据模型

请给出 MVP collection/table、字段、类型、必填、默认值、唯一约束、索引、权限、保留期和状态机。至少评估以下模型，不要求全部 P0 同时上线：

### Identity / Profile

- `profiles`
- `role_memberships`
- `student_profiles`
- `teacher_profiles`

核心字段示例：`userId`、唯一 `handle`、`displayName`、`bio`、`avatarFileId`、`locale`、`timeZone`、`availableRoles` 或规范化 role rows、`activeRole`、`ageBand`、`visibility`、`status`、timestamps。

### Matching / Learning

- `learning_requests`
- `teacher_invitations`（也可与 request 统一，但必须有清晰 kind/state machine）
- `learning_relations`
- `learning_goals`
- `learning_tasks`
- `progress_snapshots`

`LearningRelation` 必须是第一性对象，连接 student、teacher、source request、status、startedAt/endedAt、当前目标和版本信息。申请接受必须幂等；同一请求不得建立两条重复关系。

### Evidence / Proof

- `evidence_items`
- `feedback_entries`
- `proof_records`

证据必须能追溯到 relation、goal/task、作者、附件、版本和提交时间。Proof 是可解释投影，不是神秘分数。避免把所有内容塞入一个巨大 JSON 字段。

### Messaging

- `conversations`
- `conversation_members`
- `messages`
- `message_receipts` 或 member 上的 `lastReadSequence`
- `conversation_counters`（若 Appwrite 不支持安全原子序列，需要给出替代策略）

消息必须有 `messageId`、`conversationId`、`sequence`、`senderId`、`type`、`payloadVersion`、`clientMessageId`、`idempotencyKey`、`createdAt`、`editedAt/removedAt`。结构化 payload 必须有 Zod discriminated union 和大小限制。

### Connections / Safety

- `connection_requests`
- `contacts` 或 accepted connection projection
- `blocks`
- `reports`

只允许精确 handle/invite 上下文搜索。定义 pending/accepted/declined/cancelled/expired 状态与唯一索引，防止双向重复请求和骚扰。

### Evolution / Reliability

- `domain_events`
- `idempotency_keys`
- `audit_events`

根据 Appwrite 当前版本验证是否可在同一 transaction 中完成业务写和 outbox 写。如果 TablesDB transaction 不满足需求，必须设计幂等重试、状态修复任务和补偿策略；不要假装跨表写天然原子。

知识节点哲学可通过稳定实体 ID、版本、provenance 和 relations 逐步实现。MVP 可只落 `knowledge_nodes/knowledge_relations` 的最小模型或在 P1 引入，但必须说明如何从 goals/tasks/evidence/proofs 演进，不能用复杂图数据库阻塞首个闭环。

## 7. API 合同

统一前缀建议 `/v1`，统一 envelope：

```ts
type ApiSuccess<T> = {
  requestId: string;
  data: T;
  error: null;
};

type ApiFailure = {
  requestId: string;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

必须输出 endpoint 矩阵：method、path、auth、role、request schema、response schema、idempotency、rate limit、side effects、events、错误码。

至少规划：

- `/v1/me`、角色选择、profile read/update、data export/delete。
- teacher search/profile。
- learning requests/invitations list/create/accept/decline/cancel。
- learning relations list/detail。
- goals/tasks create/update/complete。
- evidence create/list/review、feedback create。
- proof list/detail。
- connection lookup/request/accept/decline/cancel/block/report。
- conversations list/detail/messages incremental list/send/mark-read。
- upload intent/complete 或服务端授权的 Storage 流程。
- health/readiness/version。

使用游标分页，不以 offset 作为移动端默认。时间使用 UTC ISO 8601；客户端负责 locale 展示。错误 `message` 使用英文，客户端主要依赖稳定 `code`，不得解析自然语言。

## 8. 结构化消息与同步

消息系统必须遵守：

- 先可靠持久化，后 Realtime/通知分发。
- `clientMessageId + idempotencyKey + actorId` 去重。
- 会话内 `sequence` 单调递增；若 Appwrite 无可靠原子自增，明确使用 counter row + transaction、Function 串行化、ULID 排序或其他已验证方案，并说明一致性边界。
- Realtime 事件只包含最小提示或安全投影；客户端收到后按 API 增量同步。
- 断线重连按 `afterSequence`/cursor 补齐。
- read position 只前进不后退。
- sender 必须是 conversation member；block 状态即时生效。
- 消息 payload 为版本化 discriminated union：`text`、`goal_created`、`task_assigned`、`evidence_submitted`、`feedback_added`、`milestone_reached`、`system`。
- MVP 可只支持 1:1 relation conversation；群聊、typing、presence、reaction、message edit 可延后。

输出发送、接收、重连、幂等重试、标记已读五个时序图。

## 9. Realtime、事件与投影

结合“事件驱动但不过早微服务化”原则规划：

- Domain event schema：eventId、eventType、aggregateType、aggregateId、actorId、payloadVersion、occurredAt、requestId、causationId、correlationId。
- 事件先用于站内通知、会话预览、未读数、简单 progress projection 和审计。
- Appwrite Function event trigger 只做可重试投影；handler 必须幂等。
- 每个投影记录 last processed event 或 unique event ID。
- 不让 Realtime 成为唯一事实来源。
- 失败事件有重试、dead-letter/failed 状态和人工修复脚本。
- 避免为了理念一次性实现 Knowledge Engine、Reputation Engine、Governance Engine 等多个部署服务；先保留模块边界和事件契约。

## 10. Storage 与上传

至少规划两个 bucket 或清晰用途隔离：avatar 与 evidence attachments。

- 客户端先向 BFF 请求 upload intent/permission，再调用 Appwrite Storage 或经 Function 上传。
- 限制 MIME、扩展名、大小、文件数和用途。
- 生成不可猜测 file ID；记录 owner、relation/task、checksum、status。
- 上传完成后由服务端校验 metadata 并绑定业务实体。
- 删除/替换要有引用检查和保留策略。
- 默认私有；通过 row/file permission 或短期预览 URL 授权。
- 计划恶意文件扫描接口，但可将实际扫描列为 P1；上线前明确风险。

## 11. 安全、隐私与治理

- 不存真实姓名、证件、人脸模板、精确生日和地址等非必要数据。
- Email 属于 Appwrite Account；业务 profile 只保存必要投影，避免重复 PII。
- 配置 CORS allowlist、OAuth redirect allowlist、request body limit、rate limit 和安全 header。
- 对 auth、账号枚举、teacher search、connection request、message send、upload 分别限流。
- 精确 handle 查询要防枚举；不存在与不可见的响应避免泄漏。
- block 优先级高于 connection/relation/message 权限。
- 所有治理写操作记录 actor、reason、requestId、resource、timestamp；支持申诉语义。
- 日志禁止 token、JWT hash 原值映射、OAuth secret、email 全文、消息/证据正文、上传 URL 和 API key。
- 支持导出与删除；定义硬删除、匿名化、法律保留和共享学习证据之间的冲突处理。
- 数据区域、DPA、备份、恢复、保留期和未成年人政策需列出部署前检查项。
- AI 若未来接入，必须经独立 port，记录模型、来源与置信度，不能直接写核心事实。

## 12. Appwrite 配置与部署

规划 `appwrite.config.json` 以及可重复脚本：

- Project settings、platform IDs、OAuth providers。
- TablesDB database、tables、columns、indexes、permissions。
- Buckets 与 file permissions。
- API Function：runtime、entrypoint、timeout、memory、build command、env vars。
- 可选 projection/cleanup Function 与 event triggers。
- 本地 Node adapter 与 production Function 共享 Hono core。
- `.env.example` 分离 `EXPO_PUBLIC_*` 与 server secrets；任何 `EXPO_PUBLIC_*` 都视为公开。
- 后端环境变量以 `backend/.env.example` 为准，变量名沿用 `E:\proto-store\backend`：`APPWRITE_ENDPOINT`、`APPWRITE_PROJECT_ID`、`APPWRITE_API_KEY`、`APPWRITE_DATABASE_ID`、`APPWRITE_ADMIN_TEAM_ID`、`APPWRITE_EVIDENCE_BUCKET_ID`、`PORT`、`CORS_ORIGINS`、`RATE_LIMIT_PER_MIN`、`LOG_LEVEL`、`NODE_ENV`、`API_DEV_BYPASS_USER_ID`。本地 BFF 固定端口 **8070**，`CORS_ORIGINS` 默认允许前端 Web `http://localhost:8071`。配置加载沿用 `app-env.ts` + Zod 校验、启动即失败的模式；Appwrite Function 部署时同名变量写入 Function env vars。开发 Appwrite 项目 `6ab149e4001d09a18de3`（`https://sfo.cloud.appwrite.io/v1`）；API key 只存在 `backend/.env` 与 Function env，不得出现在日志、前端 bundle 或仓库。
- dev/staging/prod 三环境使用独立 Appwrite project；禁止生产 dev bypass。
- schema ensure 脚本默认只创建缺失项，不擅自破坏已有列；破坏性迁移必须有显式计划和备份。

给出本地启动、构建 Function、部署 schema、seed、typecheck、test、smoke 和回滚命令模板。

## 13. 测试、可观测性与运维

测试至少包括：

- Domain 状态机与 Zod schema 单测。
- Repository 集成测试（真实 Appwrite 测试项目或隔离 namespace）。
- Auth/JWT、role、resource membership、block 权限测试。
- request → accepted relation 幂等测试。
- message 幂等、sequence、incremental sync、read position 测试。
- Realtime 丢失后的 API 补齐测试。
- upload 授权、大小/MIME、越权访问测试。
- export/delete 测试。
- rate limit、body limit、CORS、错误 envelope 测试。
- Function adapter 与 Node adapter 合同一致性测试。

可观测性：结构化日志、requestId/correlationId、route latency、error rate、Function execution failure、projection lag、idempotency conflict、Realtime reconnect，不记录敏感正文。定义 health/readiness 与 smoke checklist。

测试脚本若会修改共享数据，必须串行、可重复并自动清理；不要并发污染种子数据。

## 14. 实施阶段建议

请输出详细拆分并验证依赖，至少包含：

- **Phase 0 — Foundation**：backend package、Hono 双适配器、config、errors、logging、Appwrite client、contracts、CI。
- **Phase 1 — Identity & profiles**：Appwrite JWT、roles、onboarding、student/teacher profile、privacy。
- **Phase 2 — Matching to relation**：teacher search、learning request/invitation、accepted LearningRelation。
- **Phase 3 — Learning workspace**：goals、tasks、evidence、feedback。
- **Phase 4 — Messaging**：1:1 conversation、structured messages、idempotency、sequence、incremental sync、Realtime hint。
- **Phase 5 — Proof & simple projections**：proof record、milestones、可解释统计，不做复杂图算法。
- **Phase 6 — Safety & release**：connections、block/report、export/delete、rate limits、security review、backup/recovery、staging smoke。

如果更安全，可把 connection request 提前到 Phase 2，但保持极简。每个阶段必须有：数据库变更、API、事件、测试、seed、前端联调契约、风险、回滚和 Definition of Done。

## 15. 输出格式

请输出一份 Markdown 后端开发规划，至少包含：

1. 基线审计、版本与 ADR。
2. 架构图、信任边界和依赖方向。
3. 工程目录与 package scripts。
4. Domain model、状态机与事件清单。
5. Appwrite tables/columns/indexes/permissions/retention 矩阵。
6. Storage、Function、Realtime 配置。
7. 完整 API endpoint/错误码/幂等/rate-limit 矩阵。
8. Auth、role、resource authorization 设计。
9. Messaging 同步与结构化 payload 设计。
10. 事件/outbox/projection 的一致性方案；明确 Appwrite 能力验证结果。
11. 隐私、安全、未成年人、导出/删除和治理设计。
12. 本地开发、部署、迁移、seed、回滚与灾备。
13. 单元/集成/合同/安全/smoke 测试方案。
14. 分阶段、可拆票任务清单；每项含依赖、产出、验证命令和 DoD。
15. 与前端共同冻结的 contracts 与 sample payload。
16. 风险、容量假设、成本假设和未决问题。

## 16. 质量要求

- 不要把 Rust 当前实现逐行翻译成 TypeScript；保留领域边界与可靠性原则，适配 Appwrite 能力。
- 不要让 Hono route handler 直接堆积 TablesDB 查询和业务规则。
- 不要允许客户端用公开 SDK 直接写核心业务表。
- 不要依赖 Realtime 保证消息正确性。
- 不要用巨大 JSON 代替领域建模、索引和版本化契约。
- 不要为“知识图谱”过早引入图数据库、复杂评分引擎或微服务。
- 不要为了极简而省略授权、幂等、审计、错误恢复和数据删除。
- 任何 Appwrite 特性结论都必须基于当前安装版本与官方文档验证，并在 ADR 中记录。
