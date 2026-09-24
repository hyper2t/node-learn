# L5 学习证明写时增量计算 + 计数器并发（计划）

> 日期：2026-09-24　状态：待审
> 来源：hardening plan 第 157 行把这两项划给 L5。

## 1. 现状问题

| # | 问题 | 位置 | 后果 |
|---|------|------|------|
| P1 | `evidenceCount`、`openTasks` 用「读出旧值 +1 再写回」 | proof.ts submitEvidence / addFeedback；learning.ts createTask / updateTask | 两个请求同时写会丢一次更新，计数偏小或偏大 |
| P2 | Q&A 删除回答时 `answerCount` 也是读出再写回 | qa.ts removeContent | 同样的竞态（新增回答那边已经是原子的） |
| P3 | 每次写操作都调用 `recomputeProof`：5 次列表查询 + 1 次写 | 目标/任务/证据/反馈的 9 个写入点 | 写操作变慢，频繁写时压力大 |
| P4 | `recomputeProof` 的查询有 `limit(100/200)` 上限 | proof.ts | 超过 200 条证据或反馈时，统计数字被截断 |
| P5 | `GET /relations/:id/proof` 在读取时重算并写库 | routes/relations.ts:92 | 读接口产生写入，而且每次打开都要全量扫描 |
| P6 | 并发的全量重算会互相覆盖（后写的赢） | proof.ts | 短时间内数字可能不对（下一次写入会修正） |

## 2. 方案

### 2.1 计数器改原子操作（P1、P2）
- `db/repo.ts` 新增 `decrementColumn(table, id, col, value, min = 0)`，对应 `tablesDB.decrementRowColumn`。
- 以下写入改成原子操作，不再用 `rel.x + 1` 写回：
  - `evidenceCount`：+1
  - `openTasks`：±1，递减时下限为 0
  - `answerCount`（删除回答时）：-1，下限为 0；再根据返回的新值决定问题状态
- 其他字段（`lastActivityAt`、`currentGoalId`）照常用 `updateRow`，分开写。

### 2.2 学习证明写时增量（P3–P6）
proof_records 的字段分两类：

- **计数字段**：`tasksDone`、`evidenceSubmitted`、`feedbackReceived`、`revisions`。在对应的写入点对 proof 行做原子 ±1：
  | 事件 | 变化 |
  |------|------|
  | 提交证据 | evidenceSubmitted +1 |
  | 老师反馈 | feedbackReceived +1 |
  | 修改后重交 | revisions +1 |
  | 任务变为 done（反馈时勾选完成，或编辑任务） | tasksDone +1 |
  | 任务从 done 改回其他状态 | tasksDone -1（下限 0） |
- **展示字段**：`currentFocus`、`milestonesJson`、`recentChange`、`nextStep`。只在相关事件时直接覆盖写，不再做全量查询：
  - 提交或重交证据 → recentChange = `Submitted "标题"`
  - 反馈 → recentChange = `Feedback on "标题"`，有 nextStep 就写 nextStep
  - 目标新建、改状态或切换焦点 → 重算 currentFocus 和 milestones。只查这段关系的 goals（≤100 条），外加每个已达成目标的一条证据
  - 新建或编辑任务 → 没有反馈给出的 nextStep 时，用最早到期的未完成任务补上
- 新增 `ensureProofRow(relationId)`：proof 行不存在时先建一条全 0 的（rowId = relationId，冲突当作已存在），然后才做原子操作。

### 2.3 读取与修复
- `GET /proof`：只读已存的行。不存在时才执行一次全量重算并写入（兼容老数据）。
- `recomputeProof` 保留，作为**修复路径**：改为分页全量统计，去掉 200 条上限，结果与增量计数对齐。
- 自动对账：每小时的 node-learn-reminders 里加一步，只处理过去 2 小时内 `lastActivityAt` 有变化的关系（每次最多 200 段）。全量重算 proof，同时校正 `openTasks` 和 `evidenceCount`；发现偏差记一条 `log.warn('proof_drift')`。
- 手动脚本：`npm run proof:rebuild [-- --relation <id>]`，用于上线后一次性回填和排查。

### 2.4 不改的部分
- 界面、契约类型不变（ProofRecord 结构一样）。
- 不新增表或列，不需要执行 tables:ensure。
- 结课总结（L4.2）仍按快照全量生成，只在结束时生成一次，不受影响。

## 3. 测试
- 纯函数 `proofDeltaFor(event)` 和 `taskDoneDelta(before, after)` 的单元测试。
- 用 mock 的 repo 验证：并发两次 submitEvidence 调用的是两次 increment，而不是两次 `update(evidenceCount: n+1)`。
- `recomputeProof` 分页：模拟 250 条证据，确认统计为 250。
- 对账：制造偏差 → 执行对账 → 数字被修正，并记录 `proof_drift`。

## 4. 上线顺序
1. 部署 API：增量逻辑生效。
2. 执行一次 `npm run proof:rebuild`：回填全部现有关系，修掉历史上的截断和竞态偏差。
3. 部署 node-learn-reminders：开启每小时对账。
4. commit + push。

## 5. 需要确认
1. 对账范围：过去 2 小时有活动的关系、每小时一次，可以吗？还是改成每天全量一次？
2. `GET /proof` 改为只读，行不存在时才重算，可以吗？
3. P2（Q&A 的 answerCount）要不要顺便一起修？默认修。
