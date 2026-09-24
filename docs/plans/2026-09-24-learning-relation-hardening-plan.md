# 师生学习关系加固计划（L1–L3）

> 日期：2026-09-24 ｜ 状态：待评审 ｜ 来源：学习关系互动流程审计（问题编号沿用审计报告 #1–#21）
> 范围：L1 权限与状态加固、L2 通知与"轮到谁"、L3 作业闭环。L4（教师待办/结课总结）、L5（打磨）另立计划。
> 流程：本文件评审通过后再写代码；每阶段结束跑 `npm run check` + 后端 `typecheck/vitest/schema:check/contract`。

## 0. 设计原则
1. **后端是唯一权威**：所有权限与状态约束在 service 层校验，前端隐藏按钮只是体验。
2. **显式状态机**：关系 / 目标 / 任务 / 证据各自有允许的转换表，非法转换返回 `409 INVALID_STATE`。
3. **每个影响对方的写操作 = 业务写 + `emitEvent` + `notify`**（沿用现有 best-effort、dedupeKey 幂等）。
4. **可重试**：所有 POST 继续走 `withIdempotency`；多步写入用确定性 ID，保证重放不产生重复行。

---

## L1 — 权限与状态加固（约 1–2 天）

### L1.1 关系状态机（#1、#4）
| 从 \ 到 | active | paused | ended |
|---|---|---|---|
| active | — | 任一方，需确认 | 任一方，**必填理由** |
| paused | 任一方（见下） | — | 任一方，必填理由 |
| ended | ✗ | ✗ | ✗ |

- 同状态转换（paused→paused）返回 `409 INVALID_STATE`。
- **恢复规则**：谁暂停谁可直接恢复；另一方恢复也允许（避免一方"挂起"关系），但会通知对方。记录 `pausedBy`。
- 新增列（`learning_relations`）：`pausedBy varchar(36)`、`pausedAt datetime`、`endedBy varchar(36)`、`endReason varchar(500)`。同步 `appwrite.config.json`，`tables:ensure` 应用。
- Schema：`updateRelationStatus` 改为 `{ status, reason? }`，`status='ended'` 时 `reason` 必填（1–500）。

### L1.2 统一"关系可写"守卫（#4）
新增 `assertRelationWritable(rel)`：`status !== 'active'` → `409 RELATION_NOT_ACTIVE`。
应用到：`createGoal`、`updateGoal`、`createTask`、`updateTask`、`submitEvidence`、`addFeedback`。
- 例外：只读接口、消息（暂停期允许沟通，ended 后会话只读——现状保持，确认即可）。

### L1.3 角色矩阵（#3、#8 部分）
| 操作 | 老师 | 学生 |
|---|---|---|
| 新建/编辑目标（标题、描述） | ✓ | ✓（学生提议）|
| 目标 → achieved / dropped | ✓ | ✗（学生可"申请完成"，见 L3.2）|
| 新建/编辑/放弃任务 | ✓ | ✗ |
| 任务 → done | ✓ | ✗ |
| 任务 → submitted（学生标记已交） | — | 提交证据时自动 |
| 提交/重交证据 | ✗ | ✓ |
| 反馈 | ✓ | ✗ |

- `updateTask`：非老师 → `403 ROLE_REQUIRED`；状态值用 zod enum 限定。

### L1.4 接受请求可安全重试（#5）
- 关系 ID 已确定性；**首个目标 ID 改为确定性** `goalRowId(relationId, 'seed')`，创建时遇 409 视为已存在。
- 顺序：建关系 → 建种子目标 → 设 `currentGoalId` → 请求置 accepted。任何一步失败重试都从头幂等执行，最终一致。
- 种子目标描述不再使用邀请附言（#17 顺带修）：附言保留在请求上，作为关系会话的第一条系统消息。

### L1.5 同一对师生只允许一段"未结束"关系（#6）
- `assertNoOpenPair` 同时检查 `active` 和 `paused` 关系；存在 paused 时返回 `409 PAIR_RELATION_PAUSED`，前端提示"去恢复已有关系"并给链接。

### L1.6 测试（#21 部分）
新增 `backend/tests/learning.test.ts`（沿用 vi.mock + dev header 模式）：
- 状态机：合法/非法转换、ended 必填理由、ended 后不可改。
- 暂停中 6 个写接口全部 409。
- 学生调用 updateTask / 目标 achieved → 403。
- acceptRequest 在"种子目标已存在"下重放不产生重复。
- paused 关系存在时再发请求 → 409。

**验收**：以上测试全绿；前端对应按钮在非 active 状态隐藏，409/403 映射为可读中文错误。

---

## L2 — 通知与"轮到谁"（约 1 天）

### L2.1 新增通知类型（#2、#13）
| type | 接收方 | href |
|---|---|---|
| `relation.paused` / `relation.resumed` | 对方 | `/relations/:id` |
| `relation.ended`（正文含理由） | 对方 | `/relations/:id` |
| `goal.created`（仅学生提议时通知老师，老师新建时通知学生） | 对方 | `/relations/:id` |
| `goal.completion_requested` / `goal.achieved` | 对方 | `/relations/:id` |
| `evidence.revision_requested`（L3） | 学生 | 证据详情 |
| `task.due_soon` / `task.overdue`（L3） | 学生（overdue 同时通知老师） | 关系页 |

- 同时写入关系会话一条 `system` 消息（暂停/恢复/结束/目标完成），让双方在聊天流里看到历史。
- `NotificationType` 联合类型、`src/types/api.ts` ↔ 后端契约镜像同步；前端通知列表图标映射补齐。

### L2.2 前端确认与理由（#1）
- 暂停：确认对话框（"暂停后双方都不能布置任务或提交证据"）。
- 结束：底部弹窗，必填理由（多行，≤500），二次确认。
- 已结束关系顶部横幅：显示结束方、时间、理由。

### L2.3 "轮到谁"指示（#12）
后端在 `RelationSummary` / 关系详情中新增派生字段 `nextAction`（读时计算，无需存储）：
| 优先级 | 条件 | nextAction | 显示 |
|---|---|---|---|
| 1 | 关系非 active | `none` | 状态横幅 |
| 2 | 有 submitted 且未点评的证据 | `teacher_review` | "等待老师点评（N）" |
| 3 | 有 revision_requested 证据 | `student_revise` | "等待学生修改" |
| 4 | 有 open 任务 | `student_submit` | "等待学生提交（最近截止 X）" |
| 5 | 有目标申请完成 | `teacher_confirm_goal` | "等待老师确认目标完成" |
| 6 | 其余 | `teacher_assign` | "等待老师布置任务" |
- 关系卡片与关系页顶部显示；对当前用户是"轮到你"时高亮。

**验收**：一方暂停/结束后，对方 45 秒内看到铃铛未读；`nextAction` 单测覆盖 6 个分支。

---

## L3 — 作业闭环（约 2–3 天）

### L3.1 证据修改与重交（#7）
- 证据状态机：`submitted → reviewed | revision_requested`；`revision_requested → revised(=重新 submitted)`；`reviewed` 为终态。
- `addFeedback` 新增 `outcome: 'approved' | 'needs_revision'`（默认 approved）。已 `reviewed` 的证据再反馈 → 409。
- 新接口 `PATCH /v1/relations/:id/evidence/:evidenceId`（仅学生、仅 `revision_requested` 状态）：更新正文/附件，`version += 1`，状态回到 `submitted`，通知老师"已修改"。
- 历史：新表 `evidence_revisions`（evidenceId、version、body、attachmentFileIds、createdAt/updatedAt），保存被替换前的版本；详情页可展开"历史版本"。
- 学习证明的 `revisions` 计数改为 `version - 1` 汇总，开始有真实值。

### L3.2 目标完成确认与自动推进（#8）
- 学生：目标上"申请完成"→ 目标增加 `completionRequestedAt`，通知老师。
- 老师：确认 → `achieved`；驳回 → 清空申请并可附一句说明（进入会话消息）。
- 目标变为 achieved/dropped 时：若它是 `currentGoalId`，自动切到**最早创建的 active 目标**；没有则置空，并让 `nextAction` 提示老师新建目标。

### L3.3 任务截止日期、编辑与放弃（#9）
- 任务表单增加截止日期（日期选择器；web 用 `<input type="date">`，原生用 Expo v57 文档中推荐的日期选择方案——实施前查阅版本化文档，依赖只用 `npx expo install`）。
- 老师可编辑任务（标题/说明/截止）与"放弃"（需确认）；学生侧只读。
- 提醒：为职责分离，不复用 healthcheck / purge，**新增第 4 个定时函数 `node-learn-reminders`（`0 * * * *`，每小时）**：
  - 截止前 24h 未交 → `task.due_soon`（dedupeKey `due_soon:<taskId>`）。
  - 过截止未交 → `task.overdue`（dedupeKey `overdue:<taskId>`），同时通知老师。
  - 新函数的创建与部署属于云端动作，**届时单独请求确认**。
- 前端：逾期任务红色标签，关系卡片显示逾期数。

### L3.4 顺带修复（低成本、同一批文件）
- #14 目标/任务表单 i18n key 改为专用 `goal.title/goal.description/task.instructions`（中英双语）。
- #15 证据筛选 "All" 与状态标签走 i18n。

### L3.5 测试
- 证据：needs_revision → PATCH 重交 → version=2 → approved；reviewed 后再反馈 409；非学生 PATCH 403。
- 目标：学生申请 → 老师确认 → currentGoalId 自动推进；无剩余目标时置空。
- 提醒函数：纯函数 `selectDueTasks(now, tasks)` 单测 + dedupe 不重复发送。

**验收**：一次完整的"布置（带截止）→ 提交 → 要求修改 → 重交 → 通过 → 目标申请完成 → 确认 → 切到下个目标"链路，在 web 上手动走通，双方通知与 `nextAction` 每步正确。

---

## 4. 数据变更汇总（需同步 `appwrite.config.json` + `schema.ts` + `tables:ensure`）
| 表 | 变更 |
|---|---|
| learning_relations | + pausedBy, pausedAt, endedBy, endReason |
| learning_goals | + completionRequestedAt |
| learning_evidence | 状态值新增 `revision_requested`（varchar 已足够） |
| evidence_feedback | + outcome varchar(16) |
| evidence_revisions | **新表** |
所有新增列可空，老数据无需迁移。

## 5. 待确认的决定（评审时请拍板，括号内为默认）
1. 另一方能否直接恢复被对方暂停的关系？（**能**，并通知）
2. 学生能否新建目标？（**能**，作为提议，老师可放弃）
3. 结束理由是否对另一方可见？（**可见**）
4. 提醒用新定时函数 `node-learn-reminders` 每小时一次？（**是**，部署时再确认）
5. 已 reviewed 的证据是否允许老师"改判为需修改"？（**不允许**，保持终态，简单）

## 6. 不在本计划内
结课总结/证书/导出、评价、教师待点评汇总（L4）；学习证明改为写时增量计算、计数器并发（L5）；排课/上课记录。

## 7. 顺序与提交
L1 → L2 → L3，各阶段单独 commit（`fix(learning): …` / `feat(learning): …`），每次 commit+push 前征得确认。
