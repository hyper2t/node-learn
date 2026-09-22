# KnowNode（知节点海外版）规划提示词

本目录包含三份可独立使用的规划提示词，用于指导后续 AI/开发团队先产出可执行计划，再进入实现：

1. `01-frontend-product-design-planning-prompt.md`：前端产品与体验设计规划。
2. `02-frontend-development-planning-prompt.md`：React Native 跨端前端开发规划。
3. `03-backend-development-planning-prompt.md`：TypeScript + Appwrite 后端开发规划。

## 已确认的决策

- 工作名称：`KnowNode`（仅作为英文工作名，正式品牌名仍可替换）。
- 首发定位：全球英语版，按美国 + 欧盟/英国共同隐私与安全基线规划。
- 终端：iOS、Android、Web，共用 React Native / Expo 代码库。
- 前端基线：`E:\node-learn-en` 当前为 Expo SDK 57、React Native 0.86、React 19.2、Expo Router 57 的新项目。
- 前端样式：统一采用 NativeWind（Tailwind CSS for React Native），design tokens 映射到 `tailwind.config`，不再单独评估是否采用。
- 认证方式：普通 email/password 登录/注册（含邮箱验证与找回）、Google OAuth、Notion OAuth 三种，均通过 Appwrite OAuth2 provider 实现；同一邮箱归并为一个账号，支持绑定/解绑。Apple、GitHub 等不进入 MVP（iOS 上架是否强制 Sign in with Apple 列为待确认风险）。
- 后端基线：TypeScript + Appwrite，采用混合 BFF：客户端直连 Appwrite Account/必要的 Realtime，业务读写和聚合查询走 Hono + Appwrite Function。
- 环境变量与端口：变量名沿用 `E:\proto-store`。前端只用 `EXPO_PUBLIC_*`（`EXPO_PUBLIC_APPWRITE_ENDPOINT / PROJECT_ID / PROJECT_NAME / PLATFORM`、`EXPO_PUBLIC_API_BASE_URL`、`EXPO_PUBLIC_API_MOCK`、`EXPO_PUBLIC_WEB_URL`），后端用 `APPWRITE_ENDPOINT / PROJECT_ID / API_KEY / DATABASE_ID / ADMIN_TEAM_ID`、`PORT`、`CORS_ORIGINS`、`RATE_LIMIT_PER_MIN`、`LOG_LEVEL`、`NODE_ENV`、`API_DEV_BYPASS_USER_ID`。开发 Appwrite 项目为 `6ab149e4001d09a18de3`（endpoint `https://sfo.cloud.appwrite.io/v1`）。**前端 Web 端口 8071，后端 BFF 端口 8070**。模板见根目录 `.env.example` 与 `backend/.env.example`；`APPWRITE_API_KEY` 只出现在 `backend/.env`，禁止进入任何 `EXPO_PUBLIC_*` 或提交到 git。
- 技术参考：`E:\proto-store`，重点参考平台分离 Appwrite Client、Appwrite JWT 调 BFF、Hono 双适配器、TablesDB、Zod、契约漂移检查、Appwrite 配置即代码。
- MVP 不做支付、订单、钱包、退款和订阅；只预留未来 entitlement/plan 边界。
- 不做实名认证/KYC；老师身份通过自述资料、邮箱验证、作品与可追溯贡献逐步建立信任。
- 学生端和老师端都必须存在，并允许同一账号拥有多个角色、切换当前角色。
- 图表/图谱分析保持极简；交友/联系人申请保持极简，不发展为泛社交产品。
- 产品 UI、文案、示例数据、邮件与可访问性标签一律使用自然英文；代码标识符使用英文；规划提示词使用中文。

## 分析依据

### 现有知节点项目 `E:\zhijiedian`

已核对的关键文档与代码包括：

- `docs/zhijiedian-philosophy-and-engineering-constraints.md`
- `docs/zhijiedian-mvp-frontend-architecture.md`
- `docs/student-teacher-web-implementation-plan.md`
- `docs/student-learning-achievement-graph-implementation.md`
- `docs/im-chat-system-prd.md`
- `AGENTS.md`
- `package.json`
- `app/**`
- `src/application/**`
- `src/domains/**`
- `server/apps/bff-http/**`
- `server/crates/domain-*`
- `server/crates/api-contracts/**`
- `server/migrations/**`

并已刷新、查询 GitNexus 索引；索引在分析时与当前提交一致。核心事实是：现有项目已经形成“薄路由层 → Application → Domain → Infrastructure”的前端方向，以及“BFF → application/domain → infra adapter”的后端方向；`LearningRelation` 是系统内核，消息是结构化学习协作事件而非普通聊天字符串。

### 参考项目 `E:\proto-store`

已核对：

- Expo SDK 57 / React Native 0.86 / React 19.2 / Expo Router 57
- TanStack Query、Zustand、React Hook Form、Zod、NativeWind
- `appwrite` + `react-native-appwrite` 的 `.web.ts` / `.native.ts` 平台适配
- Appwrite Account 直接认证、短期 JWT 调用 BFF、401 单次刷新
- Hono 核心应用同时运行于本地 Node 和 Appwrite Function
- `node-appwrite` TablesDB、Storage、Team/权限、配置校验、幂等键、游标分页
- `appwrite.config.json`、构建 Function、契约漂移检查与测试脚本

## 使用建议

- 先运行产品设计规划提示词，冻结 MVP 范围与信息架构。
- 再并行运行前端、后端开发规划提示词，并让二者共享同一版 API/事件契约清单。
- 三份计划评审通过后，才开始编码。
- 每次进入编码前，都应重新读取 `E:\node-learn-en\AGENTS.md`、实际 `package.json` 和 Expo 57 精确版本文档，不从记忆假设 API。
