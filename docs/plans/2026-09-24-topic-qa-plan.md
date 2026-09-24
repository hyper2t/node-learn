# Node Learn — 主题问答区（Topic Q&A）实现计划

日期：2026-09-24 · 状态：**Q1–Q4 已实现（代码侧，门禁全绿）；Q5 部署待执行**。待确认问题已按默认决定，见 §8。

---

## 0. 一句话结论

在不改变"一对一学习关系"定位的前提下，按学习主题增加一个**轻量、以老师解答为核心、会自然收口**的问答区，并把它设计成**通往学习请求的入口**，而不是独立的社交场。

## 1. 定位护栏（必须遵守）

| 护栏 | 具体做法 | 理由 |
|---|---|---|
| 不做泛社交 | 无点赞数/排行榜/粉丝/关注人；无公开个人主页扩展 | 规划决策第 23 条 |
| 不"冷掉" | 问题有生命周期：`open → answered → closed`，14 天无新回答自动关闭；未回答问题优先推给 `subjects` 匹配的老师 | 官网文案 "not a forum thread that goes cold" |
| 老师回答为核心 | 默认仅 `teacher` 角色可回答；提问者可对回答追问一次（clarification），其他学生只读 | 保持"真人老师对你的具体问题负责" |
| 导向学习关系 | 回答卡片上提供 "Ask this teacher to work with you" → 复用现有 `POST /v1/requests` 流程 | Q&A 是获客入口而非替代品 |
| 不开私信后门 | Q&A 内不能发起私信；私信仍只在学习关系/联系人内 | 现有安全模型不变 |
| 拉黑优先 | 双向拉黑的用户互相看不到对方的问题与回答，也不能回答 | 沿用 `safety.isBlockedEitherWay` 语义 |

## 2. 主题分类

现状：`src/content/topics.ts` 的 `TOPIC_SUGGESTIONS` 只是资料页可点选的**自由文本标签**，后端无固定主题；老师资料为 `subjects[]`、学生为 `interests[]`。

方案：
- 新增固定主题目录 `backend/src/contracts/topics.ts`（前后端共享，纳入契约检查）：`{ slug, label }[]`，初始 12 个与 `TOPIC_SUGGESTIONS` 一一对应（`programming`、`math`、…、`learning-how-to-learn`）。
- `src/content/topics.ts` 改为从契约派生，保持现有资料页行为不变。
- 老师 `subjects` 与主题的匹配：大小写不敏感按 label 匹配；不迁移老数据（自由标签仍允许）。

## 3. 数据模型（TablesDB `main`，新增 2 张表 → 共 25 张）

同步修改：`backend/src/db/schema.ts`、`backend/src/db/rows.ts`、`appwrite.config.json`（`npm run api:typecheck` 会校验一致）。

**`qa_questions`**

| 列 | 类型 | 说明 |
|---|---|---|
| authorId | string(36) | 提问者 |
| topic | string(48) | 主题 slug，索引 |
| title | string(160) | |
| body | string(8000) | Markdown（渲染复用 `src/shared/markdown`） |
| attachmentFileIds | string[] | 复用 `uploads` 流程，≤3 张图 |
| status | enum open/answered/closed | 索引 |
| answerCount | integer | 冗余计数 |
| acceptedAnswerId | string(36)? | 提问者标记"解决了我的问题" |
| lastActivityAt | datetime | 索引；用于自动关闭与排序 |
| removedAt / removedBy | datetime? / string? | 管理员下架 |
| createdAt / updatedAt | datetime | 沿用 `Stamped` |

索引：`(topic, status, lastActivityAt)`、`(authorId, createdAt)`。

**`qa_answers`**

| 列 | 类型 | 说明 |
|---|---|---|
| questionId | string(36) | 索引 |
| authorId | string(36) | |
| kind | enum answer/clarification | clarification = 提问者追问 |
| parentAnswerId | string(36)? | 追问所针对的回答 |
| body | string(8000) | Markdown |
| removedAt / removedBy | | |
| createdAt / updatedAt | | |

约束：同一老师对同一问题最多 1 条 `answer`（可编辑）；每条回答最多 1 条 `clarification`。

**`reports` 扩展**：新增 `targetType`（`user`/`qa_question`/`qa_answer`，默认 `user`）与 `targetId`（可空）。老数据不变，`targetUserId` 继续填内容作者。

## 4. API（Hono，新增 `backend/src/routes/qa.ts` + `services/qa.ts` + `mappers/qa.ts`）

先写 `backend/src/contracts/api.ts` 契约与 `schemas/index.ts` 的 zod schema。

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/v1/qa/topics` | 登录 | 主题 + 各主题 open 数 |
| GET | `/v1/qa/questions?topic=&status=&cursor=` | 登录 | 游标分页；过滤拉黑与已下架 |
| GET | `/v1/qa/questions/mine` | 登录 | 我的提问 |
| GET | `/v1/qa/inbox` | teacher | `subjects` 匹配的未回答问题（反"冷掉"） |
| POST | `/v1/qa/questions` | student | 幂等（`withIdempotency`） |
| GET | `/v1/qa/questions/:id` | 登录 | 含回答与追问 |
| PATCH | `/v1/qa/questions/:id` | 作者 | 仅 open 且无回答时可改 |
| POST | `/v1/qa/questions/:id/close` | 作者 | |
| POST | `/v1/qa/questions/:id/answers` | teacher | 幂等；拉黑检查 |
| PATCH | `/v1/qa/answers/:id` | 作者 | |
| POST | `/v1/qa/answers/:id/clarify` | 问题作者 | 每回答一次 |
| POST | `/v1/qa/questions/:id/accept` | 问题作者 | 标记采纳 |
| POST | `/v1/qa/{questions\|answers}/:id/report` | 登录 | 写入 `reports` |
| POST | `/v1/admin/qa/{questions\|answers}/:id/remove` | admin | 下架 + `audit_events` |

频控：在现有 `rate-limit` 之上，发帖类接口额外限制（建议：提问 5 次/天/人，回答 30 次/天/人）。

事件与通知（复用 `services/events.ts` + `notifications`）：
- `qa.answer.created` → 通知提问者
- `qa.clarification.created` → 通知对应老师
- `qa.answer.accepted` → 通知老师
- 新问题**不**广播通知，只进入老师 inbox（避免打扰）。

定时：扩展现有 `node-learn-purge-deleted` Function，顺带将 `lastActivityAt` 超过 14 天的 open/answered 问题置为 `closed`；账号删除时问题/回答作者匿名化为 "Deleted user"（与 `services/retention.ts` 对齐）。

## 5. 前端（Expo Router，遵守 Expo 57 版本文档）

新增 `src/features/qa/`（api、hooks、components），路由：

```
src/app/(app)/qa/index.tsx          主题列表 + 各主题问题流
src/app/(app)/qa/topic/[slug].tsx   某主题问题列表（筛选 open/answered）
src/app/(app)/qa/[id].tsx           问题详情、回答、追问、采纳、举报
src/app/(app)/qa/ask.tsx            提问表单（RHF + zod，Markdown 预览，图片上传）
src/app/(app)/qa/inbox.tsx          老师：匹配我科目的待答问题
```

入口（不新增底部 Tab，控制存在感）：
- 首页 `(tabs)/index.tsx`：学生显示 "Ask a question"，老师显示 "N questions in your subjects"。
- 老师资料页 `teachers/[userId].tsx`：展示该老师最近被采纳的 3 条回答（作为信任证据，符合"作品与可追溯贡献建立信任"）。
- 回答卡片 CTA → `requests/invite` 现有流程（预填 goalTitle = 问题标题）。
- 管理后台 `admin/reports.tsx`：支持内容类举报的预览与下架。

query keys 加入 `src/state/query-keys.ts`；文案英文。

## 6. 分阶段与验收

| 阶段 | 内容 | 验收门禁 |
|---|---|---|
| Q1 契约与数据 | 主题目录、2 张表、reports 扩展、契约/zod | `npm run api:typecheck` 绿；`npm run api:tables` 幂等创建 |
| Q2 后端 | routes/services/mappers、事件通知、频控、自动关闭 | 新增 vitest：权限（学生不能答）、拉黑过滤、幂等、一次追问、采纳、自动关闭；`npm run api:test` 绿 |
| Q3 前端 | features/qa + 5 个页面 + 入口 | `npm run typecheck`、`npm run lint`、`npm test` 绿；Web 手测 |
| Q4 审核与收口 | 管理下架、举报扩展、seed 示例数据、smoke | `npm run check` 全绿；`npm run api:smoke` 覆盖提问→回答→采纳 |
| Q5 部署 | `api:tables`（线上）→ `deploy:functions` → EAS/Web | `api:verify-deploy` 通过 |

## 7. 待确认问题

1. **谁能回答**：仅老师（本计划默认）/ 老师 + 已有学习关系的学生 / 所有人？
2. **可见范围**：仅登录用户可见（默认）/ 公开可见（利于官网 SEO，但合规与审核成本更高）？
3. **未成年人**：`profiles.ageBand` 为未成年时是否禁止提问或隐藏头像/昵称？
4. **自动关闭天数**：14 天是否合适？
5. **是否需要"有用"反馈**：本计划仅保留"采纳"，不做点赞计数；如需轻量信号可加"This helped me"（不显示数字）。

## 8. 实施记录（2026-09-24）

§7 按默认决定：仅老师回答；仅登录可见；未成年人（`under_16` / `16_17`）在 Q&A 中统一显示为 "A student"（无 handle/头像）；14 天自动关闭；只保留"采纳"（"This helped me"），不做计数。

与计划的差异：
- **附件暂不做**：`evidence` 桶按学习关系授权，Q&A 公开可读需另建桶与权限，留到后续。表中未建 `attachmentFileIds`。
- **下架走举报流程**：不单独加 `/v1/admin/qa/*/remove`，而是 `POST /v1/admin/reports/:id/resolve` 新增 `action: 'remove_content'`（软删除 + 通知作者 + 审计）。后台举报卡片显示内容类型、摘要与跳转。
- **主题目录放在契约文件**：`QA_TOPICS` / `QA_AUTO_CLOSE_DAYS` 在 `src/types/api.ts`（及镜像），`src/content/topics.ts` 由其派生。
- **频控**：按 DB 计数（24h 内提问 5 / 回答 30），比进程内计数更可靠；写接口另挂现有 `social` 守卫（邮箱验证 + 30 次/分钟）。
- **唯一性**：回答/追问使用确定性 row id（哈希），由 DB 保证"每位老师每题一条""每条回答一次追问"。
- **入口**：侧边栏 "Questions"、个人页按钮、首页卡片（学生：提问；老师：待答数量）、老师主页"Answers that helped learners"；回答卡片 "Ask this teacher to work with you" 跳到老师主页并预填目标。

新增/修改文件：
- 后端：`services/qa.ts`、`services/qa-policy.ts`、`routes/qa.ts`；`app.ts`、`schemas`、`db/schema.ts`、`db/rows.ts`、`services/admin.ts`、`services/retention.ts`（删号清理 + 自动关闭）、`mappers/notifications.ts`；`scripts/seed.ts`、`scripts/smoke.ts`
- 数据：`appwrite.config.json` 新增 `qa_questions`、`qa_answers`；`reports` 新增 `targetType`、`targetId` 与索引（共 25 张表）
- 前端：`src/features/qa/*`、`src/app/(app)/qa/{index,ask,inbox,[id],topic/[slug]}.tsx`；首页、个人页、老师主页、后台举报、侧边栏、i18n、query keys
- 测试：`tests/qa-policy.test.ts`（13）、`tests/qa-routes.test.ts`（6）、`tests/retention.test.ts` 扩展

门禁：`npm run check` 退出码 0（前端 tsc + lint + vitest 21；契约 + schema(25 表) + 后端 tsc + vitest 39）；`expo export --platform web` 成功。

Q5 待办（会改动云端，需确认后执行）：
1. `npm run api:tables`（线上建 2 张表 + reports 新列/索引，幂等）
2. `npm run deploy:functions`（API + retention purge 含自动关闭）
3. 可选：`npm run api:seed` 写入示例问答；`npm run api:smoke`
4. Web / EAS 构建发布
